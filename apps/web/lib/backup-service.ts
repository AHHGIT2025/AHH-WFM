import { mockDb } from "@ahh-wfm/mock-data";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export const BackupService = {
  createBackup: async (backupType: string, createdById: string): Promise<any> => {
    // 1. Register a PENDING/PROCESSING job
    const fileName = `backup_${backupType.toLowerCase()}_${Date.now()}.json`;
    const backupsDir = path.join(process.cwd(), "storage", "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const filePath = path.join(backupsDir, fileName);

    const job = await mockDb.createBackupJob({
      backupType,
      status: "PROCESSING",
      fileName,
      filePath,
      fileSize: 0,
      checksum: "",
      createdById,
      errorMessage: undefined
    });

    try {
      // 2. Fetch the safe application data
      const data: Record<string, any> = {};

      if (backupType === "Full Database Backup" || backupType === "Employee & HR Data Backup") {
        const rawEmployees = await mockDb.getEmployees();
        // Securely exclude passwords/secrets
        data.employees = rawEmployees.map((e: any) => {
          const { passwordHash, ...safeEmp } = e;
          return safeEmp;
        });
        data.departments = await mockDb.getDepartments();
      }

      if (backupType === "Full Database Backup" || backupType === "Attendance & Leave Backup") {
        data.attendanceRecords = await mockDb.getAttendance();
        data.leaveRequests = await mockDb.getLeaves();
        data.leaveBalances = await mockDb.getLeaveBalances ? await mockDb.getLeaveBalances() : [];
        data.holidays = await mockDb.getHolidays ? await mockDb.getHolidays() : [];
      }

      if (backupType === "Full Database Backup" || backupType === "SAP Integration Config Backup") {
        data.sapConnections = await mockDb.getSapConnections ? await mockDb.getSapConnections() : [];
        // Exclude secrets from connections
        data.sapConnections = data.sapConnections.map((c: any) => {
          const { privateKeyVaultId, clientId, ...safeConn } = c;
          return safeConn;
        });
        data.sapFieldMappings = await mockDb.getSapFieldMappings ? await mockDb.getSapFieldMappings() : [];
        data.sapSyncJobs = await mockDb.getSapSyncJobs();
      }

      if (backupType === "Full Database Backup" || backupType === "System Configuration Backup") {
        data.shifts = await mockDb.getShifts();
        data.shiftTemplates = await mockDb.getShiftTemplates ? await mockDb.getShiftTemplates() : [];
        data.rotationTemplates = await mockDb.getRotationTemplates ? await mockDb.getRotationTemplates() : [];
        data.worksites = await mockDb.getWorksites ? await mockDb.getWorksites() : [];
        data.overtimeRates = await mockDb.getOvertimeRates ? await mockDb.getOvertimeRates() : [];
      }

      // 3. Serialize and write file
      const jsonString = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, jsonString, "utf8");

      // 4. Calculate checksum and size
      const hash = crypto.createHash("sha256");
      hash.update(jsonString);
      const checksum = hash.digest("hex");
      const fileSize = fs.statSync(filePath).size;

      // 5. Update job to COMPLETED
      await mockDb.updateBackupJob(job.id, {
        status: "COMPLETED",
        fileSize,
        checksum,
        completedAt: new Date().toISOString()
      });

      // 6. Log audit entry
      await mockDb.createBackupAuditLog({
        backupJobId: job.id,
        action: "BACKUP_CREATED",
        performedById: createdById,
        details: `Created backup file ${fileName} (${(fileSize / 1024).toFixed(2)} KB) of type "${backupType}".`
      });

      return { success: true, jobId: job.id, fileName };
    } catch (err: any) {
      console.error("Backup failed", err);
      
      // Update job to FAILED
      await mockDb.updateBackupJob(job.id, {
        status: "FAILED",
        errorMessage: err.message || "Unknown error during backup generation"
      });

      // Log failure audit
      await mockDb.createBackupAuditLog({
        backupJobId: job.id,
        action: "BACKUP_FAILED",
        performedById: createdById,
        details: `Backup generation failed: ${err.message || "Unknown error"}`
      });

      return { success: false, jobId: job.id, error: err.message };
    }
  }
};

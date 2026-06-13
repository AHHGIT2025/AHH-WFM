import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb } from "@ahh-wfm/mock-data";

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  const session = auth.session;
  const userId = (session?.user as any)?.id || "admin-system";

  try {
    const body = await request.json();
    const { rows, fileName, updateExisting } = body;
    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Missing rows array in payload" }, { status: 400 });
    }

    const depts = await mockDb.getDepartments();
    const existingEmployees = await mockDb.getEmployees();

    let importedCount = 0;
    let failedCount = 0;
    const failures: { row: number; errors: string[] }[] = [];

    // Register starting job in database
    const job = await mockDb.createEmployeeBulkUploadJob({
      fileName: fileName || "import.csv",
      status: "PROCESSING",
      totalRows: rows.length,
      validRows: 0,
      invalidRows: 0,
      importedRows: 0,
      failedRows: 0,
      uploadedById: userId
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const errors = [];

      if (!row.employeeId || !row.fullName || !row.email || !row.department || !row.role) {
        errors.push("Missing core required parameters");
      }

      if (errors.length > 0) {
        failedCount++;
        failures.push({ row: rowNum, errors });
        continue;
      }

      try {
        // Resolve/Create department if needed
        let deptId = "";
        const matchedDept = depts.find(d => d.name.toLowerCase() === row.department.toLowerCase());
        if (matchedDept) {
          deptId = matchedDept.id;
        } else {
          // Create new department
          const newDept = await mockDb.createDepartment(row.department);
          depts.push(newDept);
          deptId = newDept.id;
        }

        // Check if employee exists
        const matchedEmp = existingEmployees.find(e => e.id === row.employeeId);
        
        if (matchedEmp) {
          if (updateExisting) {
            // Update employee
            await mockDb.updateEmployee(matchedEmp.id, {
              name: row.fullName,
              email: row.email,
              phone: row.phone || matchedEmp.phone,
              department: row.department,
              departmentId: deptId,
              role: row.role.toUpperCase(),
              employmentStatus: row.employmentStatus || matchedEmp.employmentStatus,
              dutyStatus: row.dutyStatus || matchedEmp.dutyStatus,
              workerCategory: row.workerCategory || matchedEmp.workerCategory,
              isActive: row.employmentStatus ? (row.employmentStatus === "ACTIVE") : matchedEmp.isActive
            });
            importedCount++;
          } else {
            failedCount++;
            failures.push({ row: rowNum, errors: [`Employee ID ${row.employeeId} already exists.`] });
          }
        } else {
          // Create employee
          await mockDb.createEmployee({
            id: row.employeeId,
            name: row.fullName,
            email: row.email,
            phone: row.phone || undefined,
            department: row.department,
            departmentId: deptId,
            role: row.role.toUpperCase(),
            status: row.dutyStatus || "Offline",
            isActive: row.employmentStatus ? (row.employmentStatus === "ACTIVE") : true,
            employmentStatus: row.employmentStatus || "ACTIVE",
            dutyStatus: row.dutyStatus || "OFF_DUTY",
            workerCategory: row.workerCategory || "WHITE_COLLAR"
          });
          importedCount++;
        }
      } catch (err: any) {
        failedCount++;
        failures.push({ row: rowNum, errors: [err.message || "Failed to persist employee record."] });
      }
    }

    // Update bulk upload job status
    const isCompletedSuccess = failedCount === 0;
    await mockDb.updateEmployeeBulkUploadJob(job.id, {
      status: isCompletedSuccess ? "COMPLETED" : "FAILED",
      importedRows: importedCount,
      failedRows: failedCount,
      completedAt: new Date().toISOString(),
      errorMessage: failures.length > 0 ? JSON.stringify(failures) : undefined
    });

    // Create UserActivityLog
    await mockDb.createUserActivityLog({
      userId,
      action: "BULK_UPLOAD_COMPLETED",
      entityType: "EMPLOYEE",
      entityId: job.id,
      beforeJson: undefined,
      afterJson: JSON.stringify({
        fileName: fileName,
        totalRows: rows.length,
        importedCount,
        failedCount
      }),
      ipAddress: "127.0.0.1",
      userAgent: "Server Internal Trigger"
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      importedRows: importedCount,
      failedRows: failedCount,
      failures
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Failed to import bulk employee rows" }, { status: 500 });
  }
}

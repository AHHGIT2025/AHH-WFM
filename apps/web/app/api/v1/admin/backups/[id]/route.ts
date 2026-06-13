import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb } from "@ahh-wfm/mock-data";
import * as fs from "fs";
import * as path from "path";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  const session = auth.session;
  const userId = (session?.user as any).id;
  const id = params.id;

  try {
    const jobs = await mockDb.getBackupJobs();
    const job = jobs.find(j => j.id === id);

    if (!job) {
      return NextResponse.json({ error: "Backup job not found" }, { status: 404 });
    }

    const backupsDir = path.resolve(process.cwd(), "storage", "backups");
    const targetPath = path.resolve(backupsDir, job.fileName);

    // Prevent path traversal
    if (targetPath.startsWith(backupsDir)) {
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
    }

    // Delete database job record
    await mockDb.deleteBackupJob(id);

    // Log deletion audit
    await mockDb.createBackupAuditLog({
      backupJobId: id,
      action: "BACKUP_DELETED",
      performedById: userId,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
      details: `Deleted backup file ${job.fileName} from server storage.`
    });

    // Activity log
    await mockDb.createUserActivityLog({
      userId,
      action: "BACKUP_DELETE",
      entityType: "BackupJob",
      entityId: id,
      beforeJson: JSON.stringify(job),
      afterJson: undefined,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete backup" }, { status: 500 });
  }
}

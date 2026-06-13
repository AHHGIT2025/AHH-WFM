import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb } from "@ahh-wfm/mock-data";
import * as fs from "fs";
import * as path from "path";

export async function GET(request: Request, { params }: { params: { id: string } }) {
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

    if (job.status !== "COMPLETED") {
      return NextResponse.json({ error: "Backup file not completed or failed" }, { status: 400 });
    }

    const backupsDir = path.resolve(process.cwd(), "storage", "backups");
    const targetPath = path.resolve(backupsDir, job.fileName);

    // Prevent path traversal
    if (!targetPath.startsWith(backupsDir)) {
      return NextResponse.json({ error: "Access denied: Path traversal detected" }, { status: 403 });
    }

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json({ error: "Backup file not found on disk" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(targetPath);

    // Write audit log
    await mockDb.createBackupAuditLog({
      backupJobId: job.id,
      action: "BACKUP_DOWNLOADED",
      performedById: userId,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
      details: `Downloaded backup file ${job.fileName}.`
    });

    // Activity log
    await mockDb.createUserActivityLog({
      userId,
      action: "BACKUP_DOWNLOAD",
      entityType: "BackupJob",
      entityId: job.id,
      beforeJson: undefined,
      afterJson: JSON.stringify({ fileName: job.fileName }),
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined
    });

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${job.fileName}"`
      }
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to download backup" }, { status: 500 });
  }
}

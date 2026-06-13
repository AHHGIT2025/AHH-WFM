import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb } from "@ahh-wfm/mock-data";
import { BackupService } from "@/lib/backup-service";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const backups = await mockDb.getBackupJobs();
    const auditLogs = await mockDb.getBackupAuditLogs();
    return NextResponse.json({ backups, auditLogs });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch backups list" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  const session = auth.session;
  const userId = (session?.user as any).id;

  try {
    const payload = await request.json();
    const { backupType } = payload;

    if (!backupType) {
      return NextResponse.json({ error: "Missing backupType" }, { status: 400 });
    }

    const result = await BackupService.createBackup(backupType, userId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "Failed to initiate backup" }, { status: 500 });
  }
}

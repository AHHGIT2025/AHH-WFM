import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { isAdminUser } from "@/lib/permissions";
import fs from "fs";
import path from "path";

interface RouteParams {
  params: {
    evidenceId: string;
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const user = auth.session?.user as any;
  const isAdmin = isAdminUser(user);
  const operationAccess = user.operationAccess || {};
  const { evidenceId } = params;

  try {
    const attachment = await mockDb.getSecfacEvidenceAttachmentById(evidenceId);
    if (!attachment || !attachment.isActive) {
      return NextResponse.json({ success: false, error: "Evidence file not found" }, { status: 404 });
    }

    // 1. Verify operation scope
    let allowedOps: string[] = [];
    if (isAdmin) {
      allowedOps = ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"];
    } else {
      if (operationAccess.allowedSecurityGuarding === true) allowedOps.push("SECURITY_GUARDING");
      if (operationAccess.allowedFacilityManagement === true) allowedOps.push("FACILITY_MANAGEMENT");
    }

    if (!allowedOps.includes(attachment.operationType)) {
      return NextResponse.json({ success: false, error: "Forbidden: No access to this operation scope" }, { status: 403 });
    }

    // 2. Verify ownership: standard employee can only access their own uploads
    const isSupervisorOrAdmin = isAdmin || 
      ["SUPERVISOR", "SECURITY_SUPERVISOR", "FM_SUPERVISOR", "SECURITY_ADMIN", "FM_ADMIN", "SECURITY_OPERATIONS_MANAGER", "FM_OPERATIONS_MANAGER", "OPERATIONS_MANAGER", "HR_MANAGER"].includes(user.role?.toUpperCase().replace(/\s+/g, "_")) ||
      (user.permissions || []).some((p: string) => 
        p === "manpower.security.manage" || 
        p === "manpower.fm.manage" || 
        p.startsWith("manpower.admin.")
      );

    if (!isSupervisorOrAdmin && attachment.employeeId !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden: Cannot view another employee's evidence file" }, { status: 403 });
    }

    // 3. Verify file exists on disk
    if (!fs.existsSync(attachment.storagePath)) {
      return NextResponse.json({ success: false, error: "Evidence file not found on disk" }, { status: 404 });
    }

    // 4. Read file binary and stream response
    const fileBuffer = fs.readFileSync(attachment.storagePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": attachment.mimeType || "image/jpeg",
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

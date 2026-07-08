import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { mockDb, readDb, writeDb } from "@ahh-wfm/mock-data";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    const db = readDb() as any;
    const instructions = (db.projectInstructions || []).filter(
      (pi: any) => pi.projectId === projectId && pi.isActive !== false
    );
    return NextResponse.json(instructions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const isSuperOrAdmin = auth.session?.user && (auth.session.user.role === "ADMIN" || auth.session.user.role === "SUPER_ADMIN");
  if (!isSuperOrAdmin && 
      !hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage") &&
      !hasPermission(auth.session?.user, "security.scheduling.instructions.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const { id, projectId, instructionTitle, instructionDescription, requirementType, severity, expiryWarningDays, isActive } = payload;

    if (!projectId || !instructionTitle) {
      return NextResponse.json({ error: "projectId and instructionTitle are required" }, { status: 400 });
    }

    const db = readDb() as any;
    db.projectInstructions = db.projectInstructions || [];

    let record: any = null;

    if (id) {
      const idx = db.projectInstructions.findIndex((pi: any) => pi.id === id);
      if (idx !== -1) {
        db.projectInstructions[idx] = {
          ...db.projectInstructions[idx],
          instructionTitle,
          instructionDescription,
          requirementType,
          severity,
          expiryWarningDays: Number(expiryWarningDays || 0),
          isActive: isActive !== false,
          updatedAt: new Date().toISOString()
        };
        record = db.projectInstructions[idx];
      } else {
        return NextResponse.json({ error: "Instruction not found" }, { status: 404 });
      }
    } else {
      record = {
        id: `pi-${Date.now()}`,
        projectId,
        instructionTitle,
        instructionDescription,
        requirementType,
        severity,
        expiryWarningDays: Number(expiryWarningDays || 0),
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.projectInstructions.push(record);
    }

    writeDb(db);

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const updated = await mockDb.updateEmployee(params.id, { isLocked: false, failedLoginAttempts: 0 } as any);
    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { passwordHash, ...rest } = updated;
    return NextResponse.json({ message: "Account unlocked", user: rest });
  } catch (e) {
    return NextResponse.json({ error: "Failed to unlock account" }, { status: 500 });
  }
}

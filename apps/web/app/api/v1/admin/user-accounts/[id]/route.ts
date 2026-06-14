import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const payload = await request.json();
    const { username, authMode, isLoginEnabled } = payload;

    if (username !== undefined && username.trim() === "") {
      return NextResponse.json({ error: "Username cannot be empty" }, { status: 400 });
    }

    const employees = await mockDb.getEmployees();
    
    if (username !== undefined) {
      if (employees.some(e => e.id !== params.id && e.username?.toLowerCase() === username.trim().toLowerCase())) {
        return NextResponse.json({ error: "Username already exists" }, { status: 400 });
      }
    }

    const updated = await mockDb.updateEmployee(params.id, {
      username: payload.username,
      authMode: payload.authMode,
      isLoginEnabled: payload.isLoginEnabled
    } as any);

    if (!updated) {
      return NextResponse.json({ error: "User account not found" }, { status: 404 });
    }

    const { passwordHash, ...rest } = updated;
    return NextResponse.json(rest);
  } catch (e) {
    return NextResponse.json({ error: "Failed to update user account" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const employees = await mockDb.getEmployees();
    // Return employee data stripped of passwordHash
    const accounts = employees.map(({ passwordHash, ...rest }) => rest);
    return NextResponse.json(accounts);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch user accounts" }, { status: 500 });
  }
}

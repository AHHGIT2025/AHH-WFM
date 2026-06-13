import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import * as fs from "fs";
import * as path from "path";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "HR", "FINANCE"]);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get("file");

    if (!file) {
      return NextResponse.json({ error: "Missing file parameter" }, { status: 400 });
    }

    const exportsDir = path.resolve(process.cwd(), "storage", "exports");
    const targetPath = path.resolve(exportsDir, file);

    // Prevent path traversal
    if (!targetPath.startsWith(exportsDir)) {
      return NextResponse.json({ error: "Access denied: Path traversal detected" }, { status: 403 });
    }

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(targetPath);
    const extension = path.extname(file).toLowerCase();
    
    let contentType = "application/octet-stream";
    if (extension === ".csv") contentType = "text/csv";
    else if (extension === ".json") contentType = "application/json";
    else if (extension === ".pdf") contentType = "application/pdf";
    else if (extension === ".xlsx") contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${file}"`
      }
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to download export file" }, { status: 500 });
  }
}

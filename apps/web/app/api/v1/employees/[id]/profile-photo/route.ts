import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { mockDb } from "@ahh-wfm/mock-data";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await checkApiAuth(["ADMIN"]);
    if (auth.error) return auth.error;

    const targetEmployeeId = params.id;
    if (!targetEmployeeId) {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPG, PNG, and WebP are allowed." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 5MB limit." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // generate safe filename
    const ext = file.name.split('.').pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpeg", "jpg", "png", "webp"].includes(ext) ? ext : "jpg";
    const filename = `${targetEmployeeId}-${Date.now()}-${crypto.randomUUID().split('-')[0]}.${safeExt}`;
    
    // Save to Web public uploads
    const webUploadDir = path.join(process.cwd(), "public", "uploads", "profile-photos");
    if (!fs.existsSync(webUploadDir)) {
      fs.mkdirSync(webUploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(webUploadDir, filename), buffer);

    // Save to Mobile public uploads
    try {
      const mobileUploadDir = path.join(process.cwd(), "..", "mobile", "public", "uploads", "profile-photos");
      if (!fs.existsSync(mobileUploadDir)) {
        fs.mkdirSync(mobileUploadDir, { recursive: true });
      }
      fs.writeFileSync(path.join(mobileUploadDir, filename), buffer);
    } catch (err) {
      console.warn("[Profile Photo Sync] Failed to write to mobile directory:", err);
    }

    const publicUrl = `/uploads/profile-photos/${filename}`;

    // Update DB
    const updatedEmployee = await mockDb.updateEmployee(targetEmployeeId, {
      profilePhotoUrl: publicUrl,
      profilePhotoUpdatedAt: new Date()
    } as any);

    if (!updatedEmployee) {
      return NextResponse.json({ error: "Employee not found in database" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      profilePhotoUrl: publicUrl,
      profilePhotoUpdatedAt: updatedEmployee.profilePhotoUpdatedAt,
      id: updatedEmployee.id,
      employeeId: updatedEmployee.id,
      name: updatedEmployee.name,
      role: updatedEmployee.role
    });

  } catch (error) {
    console.error("POST /employees/[id]/profile-photo Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../lib/auth";
import { prisma } from "@ahh-wfm/database";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const filename = `${userId}-${Date.now()}-${crypto.randomUUID().split('-')[0]}.${safeExt}`;
    
    // Determine upload directory relative to project root
    const uploadDir = path.join(process.cwd(), "public", "uploads", "profile-photos");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, buffer);

    const publicUrl = `/uploads/profile-photos/${filename}`;

    // Update DB
    const updatedEmployee = await prisma.employee.update({
      where: { id: userId },
      data: {
        profilePhotoUrl: publicUrl,
        profilePhotoUpdatedAt: new Date(),
      }
    });

    return NextResponse.json({ 
      success: true, 
      profilePhotoUrl: publicUrl,
      profilePhotoUpdatedAt: updatedEmployee.profilePhotoUpdatedAt
    });

  } catch (error) {
    console.error("POST /me/profile-photo Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

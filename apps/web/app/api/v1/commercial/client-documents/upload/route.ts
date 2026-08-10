import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "client-documents");

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const { session, error } = await checkApiAuth(undefined, {
    requiredPermission: "precontract.acceptance.manage"
  });

  if (error || !session || !session.user) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as any;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clientId = formData.get("clientId") as string | null;
    const clientResponseId = formData.get("clientResponseId") as string | null;
    const proposalVersionId = formData.get("proposalVersionId") as string | null;
    const documentType = (formData.get("documentType") as string) || "AWARD_EVIDENCE";
    const remarks = formData.get("remarks") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    if (!clientId) {
      return NextResponse.json({ error: "clientId is required." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({
        error: `Invalid file type '${file.type}'. Allowed types: PDF, JPEG, PNG, DOCX.`
      }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `File size exceeds maximum allowed limit of 10 MB.`
      }, { status: 400 });
    }

    // Ensure upload directory exists
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9_.-]/g, "_");
    const fileExt = path.extname(safeName);
    const uniqueFilename = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}${fileExt}`;
    const targetPath = path.join(UPLOAD_DIR, uniqueFilename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(targetPath, buffer);

    const fileUrl = `/uploads/client-documents/${uniqueFilename}`;

    const doc = await prisma.manpowerClientDocument.create({
      data: {
        clientId,
        clientResponseId: clientResponseId || null,
        proposalVersionId: proposalVersionId || null,
        documentType,
        fileName: safeName,
        fileUrl,
        storagePath: targetPath,
        remarks: remarks || null,
        uploadedBy: user.id || "system"
      }
    });

    return NextResponse.json({ success: true, document: doc });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to upload document." },
      { status: 500 }
    );
  }
}

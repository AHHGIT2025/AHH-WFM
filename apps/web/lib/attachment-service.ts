import { randomUUID, createHash } from 'crypto';
import { prisma } from '@ahh-wfm/database';
import fs from 'fs/promises';
import path from 'path';

// Local storage directory outside of /public
const STORAGE_DIR = path.join(process.cwd(), '..', '..', 'storage', 'attachments');

const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export class AttachmentService {
  static async initStorage() {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  }

  static async upload(fileBuffer: Buffer, originalName: string, mimeType: string, uploadedBy: string, companyId?: string, operationScope?: string) {
    if (!ALLOWED_MIMES.includes(mimeType)) {
      throw new Error(`Unsupported MIME type: ${mimeType}`);
    }

    if (fileBuffer.length > MAX_SIZE_BYTES) {
      throw new Error(`File exceeds size limit of 10MB.`);
    }

    // Sanitize filename
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    
    // Server-controlled name to prevent traversal or conflicts
    const fileId = randomUUID();
    const extension = path.extname(sanitizedName) || '.bin';
    const serverFilename = `${fileId}${extension}`;
    const storagePath = path.join(STORAGE_DIR, serverFilename);

    // Calculate SHA-256
    const hashSum = createHash('sha256');
    hashSum.update(fileBuffer);
    const hex = hashSum.digest('hex');

    // Store outside public dir
    await this.initStorage();
    await fs.writeFile(storagePath, fileBuffer);

    // Record in DB (Requires SystemAttachment model, assuming it exists or creating a generic log)
    // As instructed by PC-1 rules, attachments need strong linkage.
    const attachment = await prisma.systemAttachment.create({
      data: {
        id: fileId,
        originalName: sanitizedName,
        serverPath: storagePath,
        mimeType,
        sizeBytes: fileBuffer.length,
        sha256: hex,
        uploadedBy,
        companyId,
        operationScope
      }
    });

    return attachment;
  }

  static async authorizeAndDownload(attachmentId: string, userId: string, userCompanyId?: string, userScope?: string) {
    const attachment = await prisma.systemAttachment.findUnique({
      where: { id: attachmentId }
    });

    if (!attachment) throw new Error('Attachment not found.');

    // Authorization checks
    if (attachment.companyId && userCompanyId && attachment.companyId !== userCompanyId) {
      // Admins bypass this, but normal users shouldn't
      throw new Error('Unauthorized company access.');
    }
    
    if (attachment.operationScope && userScope && attachment.operationScope !== userScope) {
      throw new Error('Unauthorized scope access.');
    }

    // Prevent directory traversal attacks on retrieval just in case
    const safePath = path.resolve(attachment.serverPath);
    if (!safePath.startsWith(path.resolve(STORAGE_DIR))) {
        throw new Error('Invalid storage path detected.');
    }

    const fileBuffer = await fs.readFile(safePath);
    return { buffer: fileBuffer, mimeType: attachment.mimeType, name: attachment.originalName };
  }
}

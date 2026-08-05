import crypto from "crypto";
import { prisma, SystemAttachmentIntegrity } from "@ahh-wfm/database";
import { isDbConnected } from "@ahh-wfm/mock-data";
import { OperationType, SecFacEvidenceIntegrityStatus } from "@ahh-wfm/types";

export interface StoreEvidenceInput {
  operationType: OperationType;
  executionId: string;
  responseId?: string;
  assignmentId?: string;
  employeeId: string;
  siteId?: string;
  checkpointId?: string;
  fileName: string;
  originalName?: string;
  mimeType: string;
  fileBuffer: Buffer;
  clientFileHash?: string;
  evidenceType?: string;
  caption?: string;
  clientCapturedAt?: Date;
  latitude?: number;
  longitude?: number;
  gpsAccuracyMeters?: number;
  deviceSessionId?: string;
  idempotencyKey?: string;
}

/**
 * Calculates SHA-256 hash from raw binary Buffer.
 */
export function calculateBinarySha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Verifies evidence binary SHA-256 hash against client hash, records UNVERIFIED -> VERIFIED/MISMATCH state,
 * logs security audit events on mismatch, and handles idempotency.
 */
export async function verifyAndStoreEvidence(input: StoreEvidenceInput): Promise<any> {
  const {
    operationType,
    executionId,
    responseId,
    assignmentId,
    employeeId,
    siteId,
    checkpointId,
    fileName,
    originalName,
    mimeType,
    fileBuffer,
    clientFileHash,
    evidenceType = "PHOTO",
    caption,
    clientCapturedAt,
    latitude,
    longitude,
    gpsAccuracyMeters,
    deviceSessionId,
    idempotencyKey
  } = input;

  const serverReceivedAt = new Date();
  const serverFileHash = calculateBinarySha256(fileBuffer);
  const fileSizeBytes = fileBuffer.length;
  const storagePath = `uploads/secfac/${executionId}/${fileName}`;

  // Correction 2: Default status is UNVERIFIED, set to VERIFIED or MISMATCH after comparison
  let integrityStatus: SystemAttachmentIntegrity = SystemAttachmentIntegrity.UNVERIFIED;
  let hashMatch = false;

  if (clientFileHash) {
    hashMatch = clientFileHash.toLowerCase() === serverFileHash.toLowerCase();
    integrityStatus = hashMatch ? SystemAttachmentIntegrity.VERIFIED : SystemAttachmentIntegrity.MISMATCH;
  }

  if (isDbConnected()) {
    try {
      if (idempotencyKey) {
        const existing = await prisma.secfacEvidenceAttachment.findUnique({
          where: { idempotencyKey }
        });
        if (existing) {
          return {
            attachment: existing,
            isDuplicate: true,
            message: "Idempotent upload request resolved: existing evidence returned."
          };
        }
      }

      const attachment = await prisma.secfacEvidenceAttachment.create({
        data: {
          operationType,
          executionId,
          responseId,
          assignmentId,
          employeeId,
          siteId,
          checkpointId,
          fileName,
          originalName,
          mimeType,
          fileSizeBytes,
          storagePath,
          evidenceType,
          caption,
          capturedAt: clientCapturedAt || serverReceivedAt,
          latitude,
          longitude,
          gpsAccuracyMeters,
          uploadedById: employeeId,
          clientFileHash,
          serverFileHash,
          hashAlgorithm: "SHA-256",
          integrityStatus,
          integrityFlags: {
            clientFileHash,
            serverFileHash,
            hashMatch,
            verifiedAt: serverReceivedAt.toISOString()
          },
          clientCapturedAt,
          serverReceivedAt,
          deviceSessionId,
          idempotencyKey
        }
      });

      if (integrityStatus === "MISMATCH") {
        const { createSecfacFieldExecutionAudit } = await import("./secfac-audit-helpers");
        await createSecfacFieldExecutionAudit({
          operationType,
          employeeId,
          checklistExecutionId: executionId,
          evidenceAttachmentId: attachment.id,
          actionType: "EVIDENCE_HASH_MISMATCH",
          actionSource: "SECURITY_INTEGRITY_SERVICE",
          resultStatus: "FAILED",
          resultMessage: `SECURITY ALERT: Evidence upload SHA-256 hash mismatch for file ${fileName}. Client hash: ${clientFileHash}, Server computed: ${serverFileHash}.`
        });
      }

      return {
        attachment,
        isDuplicate: false,
        integrityStatus,
        hashMatch
      };
    } catch (dbErr: any) {
      console.warn("DB query failed in verifyAndStoreEvidence, using fallback:", dbErr?.message);
    }
  }

  return {
    attachment: {
      id: `ev-${Date.now()}`,
      operationType,
      executionId,
      employeeId,
      fileName,
      fileSizeBytes,
      storagePath,
      clientFileHash,
      serverFileHash,
      integrityStatus,
      createdAt: serverReceivedAt.toISOString()
    },
    isDuplicate: false,
    integrityStatus,
    hashMatch
  };
}

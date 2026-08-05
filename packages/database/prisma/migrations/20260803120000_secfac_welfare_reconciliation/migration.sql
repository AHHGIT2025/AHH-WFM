-- Perform safe idempotency key backfill
UPDATE `SecFacWelfareCheck`
SET `idempotencyKey` = CONCAT('LEGACY_WELFARE_', `id`)
WHERE `idempotencyKey` IS NULL;

-- AlterTable for SecFacWelfareCheck to enforce idempotencyKey NOT NULL
ALTER TABLE `SecFacWelfareCheck`
    MODIFY `idempotencyKey` VARCHAR(191) NOT NULL;

-- AlterTable for SecFacWelfareSetting: add postId column
ALTER TABLE `SecFacWelfareSetting`
    ADD COLUMN `postId` VARCHAR(191) NULL;

-- CreateIndex for SecFacWelfareSetting.postId
CREATE INDEX `SecFacWelfareSetting_postId_idx` ON `SecFacWelfareSetting`(`postId`);

-- AlterTable for SecfacEvidenceAttachment: add clientCapturedAt, deviceSessionId, integrityFlags, serverReceivedAt columns
ALTER TABLE `SecfacEvidenceAttachment`
    ADD COLUMN `clientCapturedAt` DATETIME(3) NULL,
    ADD COLUMN `deviceSessionId` VARCHAR(191) NULL,
    ADD COLUMN `integrityFlags` JSON NULL,
    ADD COLUMN `serverReceivedAt` DATETIME(3) NULL;

-- AlterTable for SecfacPatrolExecution: add evaluationRunId column
ALTER TABLE `SecfacPatrolExecution`
    ADD COLUMN `evaluationRunId` VARCHAR(191) NULL;

-- AlterTable for SecfacPatrolExecutionCheckpoint: add exceptionAcknowledgedBy, evaluationRunId columns
ALTER TABLE `SecfacPatrolExecutionCheckpoint`
    ADD COLUMN `exceptionAcknowledgedBy` VARCHAR(191) NULL,
    ADD COLUMN `evaluationRunId` VARCHAR(191) NULL;

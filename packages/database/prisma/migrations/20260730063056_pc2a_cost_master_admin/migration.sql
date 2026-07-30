/*
  Warnings:

  - You are about to drop the column `assignedRosterType` on the `RosterSlotAssignment` table. All the data in the column will be lost.
  - You are about to alter the column `operationType` on the `SecFacWelfareCheck` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `VarChar(191)`.
  - You are about to alter the column `status` on the `SecFacWelfareCheck` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(32))` to `VarChar(191)`.
  - You are about to alter the column `acknowledgementMethod` on the `SecFacWelfareCheck` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(34))` to `VarChar(191)`.
  - You are about to alter the column `exemptionType` on the `SecFacWelfareCheck` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(35))` to `VarChar(191)`.
  - You are about to alter the column `settingSourceType` on the `SecFacWelfareCheck` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(37))` to `VarChar(191)`.
  - You are about to drop the column `sourceType` on the `SecFacWelfareSetting` table. All the data in the column will be lost.
  - You are about to alter the column `operationType` on the `SecFacWelfareSetting` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(1))` to `VarChar(191)`.
  - You are about to alter the column `integrityStatus` on the `SecfacEvidenceAttachment` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(44))` to `VarChar(191)`.
  - You are about to drop the column `lastEvaluatedAt` on the `SecfacPatrolExecution` table. All the data in the column will be lost.
  - You are about to alter the column `evaluationStatus` on the `SecfacPatrolExecution` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(30))` to `VarChar(191)`.
  - You are about to drop the column `exceptionAcknowledgedById` on the `SecfacPatrolExecutionCheckpoint` table. All the data in the column will be lost.
  - You are about to alter the column `assuranceStatus` on the `SecfacPatrolExecutionCheckpoint` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(33))` to `VarChar(191)`.
  - You are about to alter the column `sequenceMode` on the `SecfacPatrolRoute` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(31))` to `VarChar(191)`.
  - Made the column `idempotencyKey` on table `SecFacWelfareCheck` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `SecFacWelfareSetting` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdById` on table `SecFacWelfareSetting` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `SecFacWelfareCheck` DROP FOREIGN KEY `SecFacWelfareCheck_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `SecFacWelfareCheck` DROP FOREIGN KEY `SecFacWelfareCheck_deploymentId_fkey`;

-- DropForeignKey
ALTER TABLE `SecFacWelfareCheck` DROP FOREIGN KEY `SecFacWelfareCheck_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `SecFacWelfareCheck` DROP FOREIGN KEY `SecFacWelfareCheck_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `SecFacWelfareCheck` DROP FOREIGN KEY `SecFacWelfareCheck_siteId_fkey`;

-- DropForeignKey
ALTER TABLE `SecFacWelfareSetting` DROP FOREIGN KEY `SecFacWelfareSetting_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `SecFacWelfareSetting` DROP FOREIGN KEY `SecFacWelfareSetting_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `SecFacWelfareSetting` DROP FOREIGN KEY `SecFacWelfareSetting_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `SecFacWelfareSetting` DROP FOREIGN KEY `SecFacWelfareSetting_siteId_fkey`;

-- DropForeignKey
ALTER TABLE `SecfacPatrolExecutionCheckpoint` DROP FOREIGN KEY `SecfacPatrolExecutionCheckpoint_alertId_fkey`;

-- DropForeignKey
ALTER TABLE `SecfacPatrolExecutionCheckpoint` DROP FOREIGN KEY `SecfacPatrolExecutionCheckpoint_exceptionAcknowledgedById_fkey`;

-- AlterTable
ALTER TABLE `RosterSlotAssignment` DROP COLUMN `assignedRosterType`;

-- AlterTable
ALTER TABLE `SecFacWelfareCheck` MODIFY `operationType` VARCHAR(191) NOT NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    MODIFY `acknowledgementMethod` VARCHAR(191) NULL,
    MODIFY `exemptionType` VARCHAR(191) NULL,
    MODIFY `exemptionReason` TEXT NULL,
    MODIFY `settingSourceType` VARCHAR(191) NOT NULL DEFAULT 'SYSTEM_DEFAULT',
    MODIFY `idempotencyKey` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `SecFacWelfareSetting` DROP COLUMN `sourceType`,
    ADD COLUMN `postId` VARCHAR(191) NULL,
    MODIFY `operationType` VARCHAR(191) NOT NULL,
    MODIFY `companyId` VARCHAR(191) NOT NULL,
    MODIFY `createdById` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `SecfacEvidenceAttachment` ADD COLUMN `clientCapturedAt` DATETIME(3) NULL,
    ADD COLUMN `deviceSessionId` VARCHAR(191) NULL,
    ADD COLUMN `integrityFlags` JSON NULL,
    ADD COLUMN `serverReceivedAt` DATETIME(3) NULL,
    MODIFY `hashAlgorithm` VARCHAR(191) NULL DEFAULT 'SHA-256',
    MODIFY `integrityStatus` VARCHAR(191) NOT NULL DEFAULT 'UNVERIFIED';

-- AlterTable
ALTER TABLE `SecfacPatrolExecution` DROP COLUMN `lastEvaluatedAt`,
    ADD COLUMN `evaluationRunId` VARCHAR(191) NULL,
    MODIFY `evaluationStatus` VARCHAR(191) NOT NULL DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE `SecfacPatrolExecutionCheckpoint` DROP COLUMN `exceptionAcknowledgedById`,
    ADD COLUMN `evaluationRunId` VARCHAR(191) NULL,
    ADD COLUMN `exceptionAcknowledgedBy` VARCHAR(191) NULL,
    MODIFY `assuranceStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `SecfacPatrolRoute` MODIFY `sequenceMode` VARCHAR(191) NOT NULL DEFAULT 'MANDATORY';

-- CreateIndex
CREATE INDEX `SecFacWelfareSetting_operationType_idx` ON `SecFacWelfareSetting`(`operationType`);

-- CreateIndex
CREATE INDEX `SecFacWelfareSetting_postId_idx` ON `SecFacWelfareSetting`(`postId`);

-- CreateIndex
CREATE INDEX `SecFacWelfareSetting_isActive_idx` ON `SecFacWelfareSetting`(`isActive`);

-- CreateIndex
CREATE INDEX `SecfacEvidenceAttachment_integrityStatus_idx` ON `SecfacEvidenceAttachment`(`integrityStatus`);

-- CreateIndex
CREATE INDEX `SecfacPatrolExecution_evaluationStatus_idx` ON `SecfacPatrolExecution`(`evaluationStatus`);

-- CreateIndex
CREATE INDEX `SecfacPatrolExecutionCheckpoint_assuranceStatus_idx` ON `SecfacPatrolExecutionCheckpoint`(`assuranceStatus`);

-- AddForeignKey
ALTER TABLE `SecFacWelfareSetting` ADD CONSTRAINT `SecFacWelfareSetting_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecFacWelfareCheck` ADD CONSTRAINT `SecFacWelfareCheck_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecFacWelfareCheck` ADD CONSTRAINT `SecFacWelfareCheck_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `SecFacWelfareSetting` RENAME INDEX `SecFacWelfareSetting_companyId_fkey` TO `SecFacWelfareSetting_companyId_idx`;

-- RenameIndex
ALTER TABLE `SecFacWelfareSetting` RENAME INDEX `SecFacWelfareSetting_siteId_fkey` TO `SecFacWelfareSetting_siteId_idx`;

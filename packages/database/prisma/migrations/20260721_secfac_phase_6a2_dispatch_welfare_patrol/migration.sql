-- CreateEnums
-- Add new enums for Phase 6A.2 Dispatch, Welfare and Patrol Assurance

-- CreateTable SecFacWelfareSetting
CREATE TABLE `SecFacWelfareSetting` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` ENUM('SECURITY_GUARDING', 'FACILITY_MANAGEMENT') NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `scopeKey` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('POST', 'SITE', 'PROJECT', 'COMPANY', 'SYSTEM_DEFAULT') NOT NULL,
    `checkFrequencyMins` INTEGER NOT NULL DEFAULT 60,
    `gracePeriodMins` INTEGER NOT NULL DEFAULT 10,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecFacWelfareSetting_scopeKey_key`(`scopeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable SecFacWelfareCheck
CREATE TABLE `SecFacWelfareCheck` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` ENUM('SECURITY_GUARDING', 'FACILITY_MANAGEMENT') NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `deploymentId` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `graceExpiresAt` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'ACKNOWLEDGED', 'MISSED', 'EXEMPTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `acknowledgedAt` DATETIME(3) NULL,
    `acknowledgementMethod` ENUM('MOBILE_APP', 'CONTROL_ROOM', 'OFFLINE_SYNC') NULL,
    `exemptionType` ENUM('SHIFT_END', 'SUPERVISOR_OVERRIDE', 'SITE_EXEMPTION') NULL,
    `exemptionReason` VARCHAR(191) NULL,
    `settingSourceType` ENUM('POST', 'SITE', 'PROJECT', 'COMPANY', 'SYSTEM_DEFAULT') NOT NULL,
    `settingSourceId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `alertId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecFacWelfareCheck_idempotencyKey_key`(`idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable SecfacEvidenceAttachment
ALTER TABLE `SecfacEvidenceAttachment`
    ADD COLUMN `clientFileHash` VARCHAR(191) NULL,
    ADD COLUMN `serverFileHash` VARCHAR(191) NULL,
    ADD COLUMN `hashAlgorithm` VARCHAR(191) NULL,
    ADD COLUMN `integrityStatus` ENUM('UNVERIFIED', 'VERIFIED', 'MISMATCH') NOT NULL DEFAULT 'UNVERIFIED',
    ADD COLUMN `idempotencyKey` VARCHAR(191) NULL,
    ADD UNIQUE INDEX `SecfacEvidenceAttachment_idempotencyKey_key`(`idempotencyKey`);

-- AlterTable SecfacPatrolRoute
ALTER TABLE `SecfacPatrolRoute`
    ADD COLUMN `sequenceMode` ENUM('MANDATORY', 'ADVISORY', 'ANY_ORDER') NOT NULL DEFAULT 'MANDATORY';

-- AlterTable SecfacPatrolExecution
ALTER TABLE `SecfacPatrolExecution`
    ADD COLUMN `evaluationStatus` ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'EXCEPTIONS_PENDING') NOT NULL DEFAULT 'SCHEDULED',
    ADD COLUMN `lastEvaluatedAt` DATETIME(3) NULL;

-- AlterTable SecfacPatrolExecutionCheckpoint
ALTER TABLE `SecfacPatrolExecutionCheckpoint`
    ADD COLUMN `assuranceStatus` ENUM('PENDING', 'ON_TIME', 'LATE', 'MISSED', 'SKIPPED', 'EXCEPTION_ACKNOWLEDGED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `targetTime` DATETIME(3) NULL,
    ADD COLUMN `lateAt` DATETIME(3) NULL,
    ADD COLUMN `missedAt` DATETIME(3) NULL,
    ADD COLUMN `sequenceDeviated` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `exceptionAcknowledged` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `exceptionAcknowledgedAt` DATETIME(3) NULL,
    ADD COLUMN `exceptionAcknowledgedById` VARCHAR(191) NULL,
    ADD COLUMN `exceptionNotes` TEXT NULL,
    ADD COLUMN `alertId` VARCHAR(191) NULL;

-- AddForeignKeys
ALTER TABLE `SecFacWelfareSetting` ADD CONSTRAINT `SecFacWelfareSetting_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SecFacWelfareSetting` ADD CONSTRAINT `SecFacWelfareSetting_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SecFacWelfareSetting` ADD CONSTRAINT `SecFacWelfareSetting_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SecFacWelfareSetting` ADD CONSTRAINT `SecFacWelfareSetting_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SecFacWelfareCheck` ADD CONSTRAINT `SecFacWelfareCheck_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SecFacWelfareCheck` ADD CONSTRAINT `SecFacWelfareCheck_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SecFacWelfareCheck` ADD CONSTRAINT `SecFacWelfareCheck_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SecFacWelfareCheck` ADD CONSTRAINT `SecFacWelfareCheck_deploymentId_fkey` FOREIGN KEY (`deploymentId`) REFERENCES `EmployeeDeployment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SecFacWelfareCheck` ADD CONSTRAINT `SecFacWelfareCheck_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SecFacWelfareCheck` ADD CONSTRAINT `SecFacWelfareCheck_alertId_fkey` FOREIGN KEY (`alertId`) REFERENCES `SecFacOperationalAlert`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SecfacPatrolExecutionCheckpoint` ADD CONSTRAINT `SecfacPatrolExecutionCheckpoint_exceptionAcknowledgedById_fkey` FOREIGN KEY (`exceptionAcknowledgedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SecfacPatrolExecutionCheckpoint` ADD CONSTRAINT `SecfacPatrolExecutionCheckpoint_alertId_fkey` FOREIGN KEY (`alertId`) REFERENCES `SecFacOperationalAlert`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE `CostCategoryMaster` DROP FOREIGN KEY `CostCategoryMaster_costConfigurationVersionId_fkey`;

-- DropForeignKey
ALTER TABLE `CostConfigurationVersion` DROP FOREIGN KEY `CostConfigurationVersion_headerId_fkey`;

-- DropForeignKey
ALTER TABLE `CostDriverMapping` DROP FOREIGN KEY `CostDriverMapping_versionId_fkey`;

-- DropForeignKey
ALTER TABLE `CostElementMaster` DROP FOREIGN KEY `CostElementMaster_versionId_fkey`;

-- DropForeignKey
ALTER TABLE `CostFormulaDefinition` DROP FOREIGN KEY `CostFormulaDefinition_versionId_fkey`;

-- DropForeignKey
ALTER TABLE `CostRateMaster` DROP FOREIGN KEY `CostRateMaster_versionId_fkey`;

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
ALTER TABLE `CostCategoryMaster` DROP COLUMN `costConfigurationVersionId`,
    DROP COLUMN `isActive`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `createdBy` VARCHAR(191) NOT NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `CostElementMaster` DROP COLUMN `categoryId`,
    DROP COLUMN `clientProvided`,
    DROP COLUMN `isActive`,
    DROP COLUMN `isDirect`,
    DROP COLUMN `isFixed`,
    DROP COLUMN `isOneTime`,
    DROP COLUMN `quantitySource`,
    DROP COLUMN `rateSource`,
    DROP COLUMN `serviceApplicabilityJson`,
    DROP COLUMN `unitOfMeasure`,
    DROP COLUMN `versionId`,
    ADD COLUMN `companyId` VARCHAR(191) NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `createdBy` VARCHAR(191) NOT NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `operationType` VARCHAR(191) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `CostFormulaDefinition` DROP COLUMN `formulaAst`,
    DROP COLUMN `versionId`,
    ADD COLUMN `companyId` VARCHAR(191) NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `createdBy` VARCHAR(191) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

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

-- DropTable
DROP TABLE `CostConfigurationHeader`;

-- DropTable
DROP TABLE `CostConfigurationVersion`;

-- DropTable
DROP TABLE `CostDriverMapping`;

-- DropTable
DROP TABLE `CostRateMaster`;

-- CreateTable
CREATE TABLE `CostCategoryVersion` (
    `id` VARCHAR(191) NOT NULL,
    `masterId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `clonedFromVersionId` VARCHAR(191) NULL,
    `workflowInstanceId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CostCategoryVersion_masterId_versionNumber_key`(`masterId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostElementVersion` (
    `id` VARCHAR(191) NOT NULL,
    `masterId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `categoryCode` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `unitOfMeasure` VARCHAR(191) NULL,
    `isOneTime` BOOLEAN NOT NULL DEFAULT false,
    `isDirect` BOOLEAN NOT NULL DEFAULT true,
    `isFixed` BOOLEAN NOT NULL DEFAULT true,
    `clientProvided` BOOLEAN NOT NULL DEFAULT false,
    `quantitySource` VARCHAR(191) NOT NULL,
    `rateSource` VARCHAR(191) NOT NULL,
    `allocationMethod` ENUM('FIXED_AMOUNT', 'PERCENTAGE', 'PER_HEAD', 'PER_SHIFT', 'SQM', 'CUSTOM_FORMULA') NOT NULL DEFAULT 'FIXED_AMOUNT',
    `serviceApplicabilityJson` JSON NULL,
    `clonedFromVersionId` VARCHAR(191) NULL,
    `workflowInstanceId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CostElementVersion_masterId_versionNumber_key`(`masterId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostDriverMaster` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CostDriverMaster_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostDriverVersion` (
    `id` VARCHAR(191) NOT NULL,
    `masterId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `targetElementCode` VARCHAR(191) NULL,
    `quantityRuleAst` JSON NULL,
    `rateRuleAst` JSON NULL,
    `escalationRuleAst` JSON NULL,
    `clonedFromVersionId` VARCHAR(191) NULL,
    `workflowInstanceId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CostDriverVersion_masterId_versionNumber_key`(`masterId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostRateCardMaster` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'QAR',
    `companyId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CostRateCardMaster_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostRateCardVersion` (
    `id` VARCHAR(191) NOT NULL,
    `masterId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `ratesJson` JSON NOT NULL,
    `clonedFromVersionId` VARCHAR(191) NULL,
    `workflowInstanceId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CostRateCardVersion_masterId_versionNumber_key`(`masterId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostFormulaVersion` (
    `id` VARCHAR(191) NOT NULL,
    `masterId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `formulaAst` JSON NOT NULL,
    `variables` JSON NULL,
    `clonedFromVersionId` VARCHAR(191) NULL,
    `workflowInstanceId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CostFormulaVersion_masterId_versionNumber_key`(`masterId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostPackageMaster` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `companyId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CostPackageMaster_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostPackageVersion` (
    `id` VARCHAR(191) NOT NULL,
    `masterId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `clonedFromVersionId` VARCHAR(191) NULL,
    `workflowInstanceId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CostPackageVersion_masterId_versionNumber_key`(`masterId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostPackageItem` (
    `id` VARCHAR(191) NOT NULL,
    `packageVersionId` VARCHAR(191) NOT NULL,
    `elementCode` VARCHAR(191) NOT NULL,
    `isMandatory` BOOLEAN NOT NULL DEFAULT true,
    `defaultQuantity` DOUBLE NULL,
    `quantityFormulaId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CostPackageItem_packageVersionId_elementCode_key`(`packageVersionId`, `elementCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostRateActivationLock` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `masterId` VARCHAR(191) NOT NULL,
    `versionId` VARCHAR(191) NOT NULL,
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `lockedById` VARCHAR(191) NULL,
    `lockedAt` DATETIME(3) NULL,
    `activationWorkflowId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CostRateActivationLock_entityType_masterId_versionId_key`(`entityType`, `masterId`, `versionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `CostCategoryMaster_code_key` ON `CostCategoryMaster`(`code`);

-- CreateIndex
CREATE UNIQUE INDEX `CostElementMaster_code_key` ON `CostElementMaster`(`code`);

-- CreateIndex
CREATE UNIQUE INDEX `CostFormulaDefinition_code_key` ON `CostFormulaDefinition`(`code`);

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

-- AddForeignKey
ALTER TABLE `CostCategoryMaster` ADD CONSTRAINT `CostCategoryMaster_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostCategoryVersion` ADD CONSTRAINT `CostCategoryVersion_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `CostCategoryMaster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostElementMaster` ADD CONSTRAINT `CostElementMaster_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostElementVersion` ADD CONSTRAINT `CostElementVersion_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `CostElementMaster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostDriverMaster` ADD CONSTRAINT `CostDriverMaster_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostDriverVersion` ADD CONSTRAINT `CostDriverVersion_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `CostDriverMaster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostRateCardMaster` ADD CONSTRAINT `CostRateCardMaster_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostRateCardVersion` ADD CONSTRAINT `CostRateCardVersion_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `CostRateCardMaster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostFormulaDefinition` ADD CONSTRAINT `CostFormulaDefinition_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostFormulaVersion` ADD CONSTRAINT `CostFormulaVersion_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `CostFormulaDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostPackageMaster` ADD CONSTRAINT `CostPackageMaster_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostPackageVersion` ADD CONSTRAINT `CostPackageVersion_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `CostPackageMaster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostPackageItem` ADD CONSTRAINT `CostPackageItem_packageVersionId_fkey` FOREIGN KEY (`packageVersionId`) REFERENCES `CostPackageVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `SecFacWelfareSetting` RENAME INDEX `SecFacWelfareSetting_companyId_fkey` TO `SecFacWelfareSetting_companyId_idx`;

-- RenameIndex
ALTER TABLE `SecFacWelfareSetting` RENAME INDEX `SecFacWelfareSetting_siteId_fkey` TO `SecFacWelfareSetting_siteId_idx`;


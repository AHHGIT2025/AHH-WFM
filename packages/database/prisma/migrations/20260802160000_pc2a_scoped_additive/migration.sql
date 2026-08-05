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

-- CreateTable CostCategoryVersion
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

-- CreateTable CostElementVersion
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

-- CreateTable CostDriverMaster
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

-- CreateTable CostDriverVersion
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

-- CreateTable CostRateCardMaster
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

-- CreateTable CostRateCardVersion
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

-- CreateTable CostFormulaVersion
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

-- CreateTable CostPackageMaster
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

-- CreateTable CostPackageVersion
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

-- CreateTable CostPackageItem
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

-- CreateTable CostRateActivationLock
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

-- AlterTable for CostCategoryMaster (Additive only)
ALTER TABLE `CostCategoryMaster`
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `createdBy` VARCHAR(191) NOT NULL DEFAULT 'SYSTEM',
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `CostCategoryMaster` ALTER COLUMN `createdBy` DROP DEFAULT;
ALTER TABLE `CostCategoryMaster` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AddUniqueIndex on CostCategoryMaster
CREATE UNIQUE INDEX `CostCategoryMaster_code_key` ON `CostCategoryMaster`(`code`);

-- AddForeignKey to Company for CostCategoryMaster
ALTER TABLE `CostCategoryMaster` ADD CONSTRAINT `CostCategoryMaster_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey for CostCategoryVersion
ALTER TABLE `CostCategoryVersion` ADD CONSTRAINT `CostCategoryVersion_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `CostCategoryMaster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AlterTable for CostElementMaster (Additive only)
ALTER TABLE `CostElementMaster`
    ADD COLUMN `companyId` VARCHAR(191) NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `operationType` VARCHAR(191) NULL,
    ADD COLUMN `createdBy` VARCHAR(191) NOT NULL DEFAULT 'SYSTEM',
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `CostElementMaster` ALTER COLUMN `createdBy` DROP DEFAULT;
ALTER TABLE `CostElementMaster` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AddUniqueIndex on CostElementMaster
CREATE UNIQUE INDEX `CostElementMaster_code_key` ON `CostElementMaster`(`code`);

-- AddForeignKey to Company for CostElementMaster
ALTER TABLE `CostElementMaster` ADD CONSTRAINT `CostElementMaster_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey for CostElementVersion
ALTER TABLE `CostElementVersion` ADD CONSTRAINT `CostElementVersion_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `CostElementMaster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AlterTable for CostFormulaDefinition (Additive only)
ALTER TABLE `CostFormulaDefinition`
    ADD COLUMN `companyId` VARCHAR(191) NULL,
    ADD COLUMN `createdBy` VARCHAR(191) NOT NULL DEFAULT 'SYSTEM',
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `CostFormulaDefinition` ALTER COLUMN `createdBy` DROP DEFAULT;
ALTER TABLE `CostFormulaDefinition` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AddUniqueIndex on CostFormulaDefinition
CREATE UNIQUE INDEX `CostFormulaDefinition_code_key` ON `CostFormulaDefinition`(`code`);

-- AddForeignKey to Company for CostFormulaDefinition
ALTER TABLE `CostFormulaDefinition` ADD CONSTRAINT `CostFormulaDefinition_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey for CostFormulaVersion
ALTER TABLE `CostFormulaVersion` ADD CONSTRAINT `CostFormulaVersion_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `CostFormulaDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey for rest of new tables
ALTER TABLE `CostDriverMaster` ADD CONSTRAINT `CostDriverMaster_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CostDriverVersion` ADD CONSTRAINT `CostDriverVersion_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `CostDriverMaster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CostRateCardMaster` ADD CONSTRAINT `CostRateCardMaster_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CostRateCardVersion` ADD CONSTRAINT `CostRateCardVersion_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `CostRateCardMaster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CostPackageMaster` ADD CONSTRAINT `CostPackageMaster_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CostPackageVersion` ADD CONSTRAINT `CostPackageVersion_masterId_fkey` FOREIGN KEY (`masterId`) REFERENCES `CostPackageMaster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CostPackageItem` ADD CONSTRAINT `CostPackageItem_packageVersionId_fkey` FOREIGN KEY (`packageVersionId`) REFERENCES `CostPackageVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Make legacy required columns nullable to support additive new masters
ALTER TABLE `CostElementMaster`
    MODIFY `versionId` VARCHAR(191) NULL,
    MODIFY `categoryId` VARCHAR(191) NULL,
    MODIFY `quantitySource` VARCHAR(191) NULL,
    MODIFY `rateSource` VARCHAR(191) NULL;

ALTER TABLE `CostFormulaDefinition`
    MODIFY `versionId` VARCHAR(191) NULL,
    MODIFY `formulaAst` JSON NULL;


-- Add missing Foreign Keys
-- NOTE: versionId FKs use RESTRICT here (differs from pc2a_clean which uses SET NULL).
-- This reflects what was directly applied to the live SERVER on 2026-08-02.
-- The drift_repair migration (20260803150000) corrects these to SET NULL.
ALTER TABLE `CostElementMaster` ADD CONSTRAINT `CostElementMaster_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `CostConfigurationVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CostFormulaDefinition` ADD CONSTRAINT `CostFormulaDefinition_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `CostConfigurationVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CostCategoryMaster` ADD CONSTRAINT `CostCategoryMaster_costConfigurationVersionId_fkey` FOREIGN KEY (`costConfigurationVersionId`) REFERENCES `CostConfigurationVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CostConfigurationVersion` ADD CONSTRAINT `CostConfigurationVersion_headerId_fkey` FOREIGN KEY (`headerId`) REFERENCES `CostConfigurationHeader`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CostRateMaster` ADD CONSTRAINT `CostRateMaster_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `CostConfigurationVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CostDriverMapping` ADD CONSTRAINT `CostDriverMapping_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `CostConfigurationVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

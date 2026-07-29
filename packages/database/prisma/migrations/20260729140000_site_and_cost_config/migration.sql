-- AlterTable
ALTER TABLE `CostCategoryMaster` ADD COLUMN `costConfigurationVersionId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `CostConfigurationVersion` ADD COLUMN `activatedAt` DATETIME(3) NULL,
    ADD COLUMN `activatedBy` VARCHAR(191) NULL,
    ADD COLUMN `clonedFromVersionId` VARCHAR(191) NULL,
    ADD COLUMN `headerId` VARCHAR(191) NOT NULL,
    ADD COLUMN `retiredAt` DATETIME(3) NULL,
    ADD COLUMN `retiredBy` VARCHAR(191) NULL,
    ADD COLUMN `workflowInstanceId` VARCHAR(191) NULL,
    ADD COLUMN `workflowTemplateId` VARCHAR(191) NULL,
    ALTER COLUMN `status` DROP DEFAULT;

-- AlterTable
ALTER TABLE `SiteConditionCategory` DROP COLUMN `companyId`,
    DROP COLUMN `operationType`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `versionId` VARCHAR(191) NOT NULL,
    MODIFY `description` VARCHAR(191) NULL,
    MODIFY `displayOrder` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `SiteConditionDefinition` DROP COLUMN `allowedOptionsJson`,
    DROP COLUMN `effectiveFrom`,
    DROP COLUMN `effectiveTo`,
    DROP COLUMN `serviceApplicabilityJson`,
    DROP COLUMN `unitOfMeasure`,
    DROP COLUMN `version`,
    ADD COLUMN `ahhResponsibility` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `clientResponsibility` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `displayOrder` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `optionsJson` JSON NULL,
    ADD COLUMN `riskWeight` DOUBLE NULL,
    ADD COLUMN `unit` VARCHAR(191) NULL,
    ADD COLUMN `versionId` VARCHAR(191) NOT NULL,
    MODIFY `description` VARCHAR(191) NULL,
    MODIFY `responseType` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `WorkflowInstance` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `moduleType` VARCHAR(191) NOT NULL,
    `referenceId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `currentLevelNumber` INTEGER NOT NULL DEFAULT 1,
    `companyId` VARCHAR(191) NULL,
    `operationScope` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowActionHistory` (
    `id` VARCHAR(191) NOT NULL,
    `instanceId` VARCHAR(191) NOT NULL,
    `levelNumber` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `actedBy` VARCHAR(191) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteConditionConfiguration` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `operationType` VARCHAR(191) NULL,
    `serviceApplicability` JSON NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SiteConditionConfiguration_code_companyId_key`(`code`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteConditionConfigurationVersion` (
    `id` VARCHAR(191) NOT NULL,
    `configurationId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `clonedFromVersionId` VARCHAR(191) NULL,
    `workflowTemplateId` VARCHAR(191) NULL,
    `workflowInstanceId` VARCHAR(191) NULL,
    `activatedBy` VARCHAR(191) NULL,
    `activatedAt` DATETIME(3) NULL,
    `retiredBy` VARCHAR(191) NULL,
    `retiredAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SiteConditionConfigurationVersion_configurationId_versionNum_key`(`configurationId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostConfigurationHeader` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `operationType` VARCHAR(191) NULL,
    `serviceApplicability` JSON NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CostConfigurationHeader_code_companyId_key`(`code`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `CostConfigurationVersion_headerId_versionNumber_key` ON `CostConfigurationVersion`(`headerId`, `versionNumber`);

-- CreateIndex
CREATE UNIQUE INDEX `SiteConditionCategory_versionId_code_key` ON `SiteConditionCategory`(`versionId`, `code`);

-- CreateIndex
CREATE UNIQUE INDEX `SiteConditionDefinition_versionId_code_key` ON `SiteConditionDefinition`(`versionId`, `code`);

-- AddForeignKey
ALTER TABLE `WorkflowInstance` ADD CONSTRAINT `WorkflowInstance_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `WorkflowTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowActionHistory` ADD CONSTRAINT `WorkflowActionHistory_instanceId_fkey` FOREIGN KEY (`instanceId`) REFERENCES `WorkflowInstance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteConditionConfigurationVersion` ADD CONSTRAINT `SiteConditionConfigurationVersion_configurationId_fkey` FOREIGN KEY (`configurationId`) REFERENCES `SiteConditionConfiguration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteConditionCategory` ADD CONSTRAINT `SiteConditionCategory_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `SiteConditionConfigurationVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteConditionDefinition` ADD CONSTRAINT `SiteConditionDefinition_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `SiteConditionConfigurationVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostConfigurationVersion` ADD CONSTRAINT `CostConfigurationVersion_headerId_fkey` FOREIGN KEY (`headerId`) REFERENCES `CostConfigurationHeader`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostCategoryMaster` ADD CONSTRAINT `CostCategoryMaster_costConfigurationVersionId_fkey` FOREIGN KEY (`costConfigurationVersionId`) REFERENCES `CostConfigurationVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


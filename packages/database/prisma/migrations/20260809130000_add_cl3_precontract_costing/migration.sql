-- CreateTable
CREATE TABLE `PreContractCostEstimate` (
    `id` VARCHAR(191) NOT NULL,
    `estimateNumber` VARCHAR(191) NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `surveyId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `operationType` VARCHAR(191) NULL,
    `currentVersionNumber` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PreContractCostEstimateVersion` (
    `id` VARCHAR(191) NOT NULL,
    `estimateId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `clonedFromVersionId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `workflowTemplateId` VARCHAR(191) NULL,
    `workflowInstanceId` VARCHAR(191) NULL,
    `costConfigVersionId` VARCHAR(191) NULL,
    `pricingBasis` VARCHAR(191) NOT NULL DEFAULT 'MARGIN',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'QAR',
    `totalDirectCost` DECIMAL(12, 2) NOT NULL,
    `totalIndirectCost` DECIMAL(12, 2) NOT NULL,
    `totalCost` DECIMAL(12, 2) NOT NULL,
    `targetMarginPercentage` DECIMAL(5, 2) NULL,
    `targetMarkupPercentage` DECIMAL(5, 2) NULL,
    `sellingPrice` DECIMAL(12, 2) NOT NULL,
    `snapshotJson` LONGTEXT NULL,
    `checksum` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PreContractCostEstimateItem` (
    `id` VARCHAR(191) NOT NULL,
    `estimateVersionId` VARCHAR(191) NOT NULL,
    `elementCode` VARCHAR(191) NOT NULL,
    `elementName` VARCHAR(191) NOT NULL,
    `categoryCode` VARCHAR(191) NOT NULL,
    `isDirect` BOOLEAN NOT NULL DEFAULT true,
    `unitOfMeasure` VARCHAR(191) NULL,
    `quantity` DECIMAL(12, 4) NOT NULL,
    `unitRate` DECIMAL(12, 2) NOT NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `calculationBasis` VARCHAR(191) NOT NULL DEFAULT 'CONFIGURED',
    `overrideReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PreContractCostOverrideLog` (
    `id` VARCHAR(191) NOT NULL,
    `estimateVersionId` VARCHAR(191) NOT NULL,
    `fieldPath` VARCHAR(191) NOT NULL,
    `priorValue` VARCHAR(191) NOT NULL,
    `newValue` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `overriddenBy` VARCHAR(191) NOT NULL,
    `overriddenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PreContractCostEstimate` ADD CONSTRAINT `PreContractCostEstimate_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `PreContractCase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreContractCostEstimate` ADD CONSTRAINT `PreContractCostEstimate_surveyId_fkey` FOREIGN KEY (`surveyId`) REFERENCES `PreContractSurvey`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreContractCostEstimateVersion` ADD CONSTRAINT `PreContractCostEstimateVersion_estimateId_fkey` FOREIGN KEY (`estimateId`) REFERENCES `PreContractCostEstimate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreContractCostEstimateItem` ADD CONSTRAINT `PreContractCostEstimateItem_estimateVersionId_fkey` FOREIGN KEY (`estimateVersionId`) REFERENCES `PreContractCostEstimateVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreContractCostOverrideLog` ADD CONSTRAINT `PreContractCostOverrideLog_estimateVersionId_fkey` FOREIGN KEY (`estimateVersionId`) REFERENCES `PreContractCostEstimateVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

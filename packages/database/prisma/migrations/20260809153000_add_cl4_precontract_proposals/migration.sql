-- CreateTable
CREATE TABLE `PreContractProposal` (
    `id` VARCHAR(191) NOT NULL,
    `proposalCode` VARCHAR(191) NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `operationType` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `currentVersionNumber` INTEGER NOT NULL DEFAULT 1,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PreContractProposalVersion` (
    `id` VARCHAR(191) NOT NULL,
    `proposalId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `clonedFromVersionId` VARCHAR(191) NULL,
    `costEstimateId` VARCHAR(191) NOT NULL,
    `costEstimateVersionId` VARCHAR(191) NOT NULL,
    `costEstimateChecksum` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `workflowTemplateId` VARCHAR(191) NULL,
    `workflowInstanceId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `sellingPrice` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `validityDays` INTEGER NULL,
    `validUntil` DATETIME(3) NULL,
    `scopeSummary` TEXT NULL,
    `assumptions` TEXT NULL,
    `exclusions` TEXT NULL,
    `termsAndConditions` TEXT NULL,
    `issuedAt` DATETIME(3) NULL,
    `issuedBy` VARCHAR(191) NULL,
    `snapshotJson` LONGTEXT NULL,
    `snapshotChecksum` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProposalIssuanceLog` (
    `id` VARCHAR(191) NOT NULL,
    `proposalVersionId` VARCHAR(191) NOT NULL,
    `issuedBy` VARCHAR(191) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recipientName` VARCHAR(191) NULL,
    `recipientEmail` VARCHAR(191) NULL,
    `deliveryMethod` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PreContractProposal` ADD CONSTRAINT `PreContractProposal_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `PreContractCase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreContractProposalVersion` ADD CONSTRAINT `PreContractProposalVersion_proposalId_fkey` FOREIGN KEY (`proposalId`) REFERENCES `PreContractProposal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreContractProposalVersion` ADD CONSTRAINT `PreContractProposalVersion_costEstimateId_fkey` FOREIGN KEY (`costEstimateId`) REFERENCES `PreContractCostEstimate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreContractProposalVersion` ADD CONSTRAINT `PreContractProposalVersion_costEstimateVersionId_fkey` FOREIGN KEY (`costEstimateVersionId`) REFERENCES `PreContractCostEstimateVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProposalIssuanceLog` ADD CONSTRAINT `ProposalIssuanceLog_proposalVersionId_fkey` FOREIGN KEY (`proposalVersionId`) REFERENCES `PreContractProposalVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

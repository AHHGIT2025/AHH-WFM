-- CreateTable
CREATE TABLE `PreContractClientResponse` (
    `id` VARCHAR(191) NOT NULL,
    `proposalId` VARCHAR(191) NOT NULL,
    `proposalVersionId` VARCHAR(191) NOT NULL,
    `responseType` VARCHAR(191) NOT NULL,
    `responseDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `clientContactName` VARCHAR(191) NULL,
    `clientReference` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `snapshotChecksum` VARCHAR(191) NOT NULL,
    `recordedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PreContractClientResponse_proposalVersionId_key`(`proposalVersionId`),
    INDEX `PreContractClientResponse_proposalId_idx`(`proposalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `ManpowerContract` ADD COLUMN `sourceClientResponseId` VARCHAR(191) NULL,
    ADD COLUMN `sourceProposalVersionId` VARCHAR(191) NULL,
    ADD COLUMN `sourceSnapshotChecksum` VARCHAR(191) NULL,
    ADD COLUMN `currency` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `ManpowerContract_sourceClientResponseId_key` ON `ManpowerContract`(`sourceClientResponseId`);

-- AlterTable
ALTER TABLE `ManpowerClientDocument` ADD COLUMN `clientResponseId` VARCHAR(191) NULL,
    ADD COLUMN `proposalVersionId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `ManpowerContract` ADD CONSTRAINT `ManpowerContract_sourceClientResponseId_fkey` FOREIGN KEY (`sourceClientResponseId`) REFERENCES `PreContractClientResponse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerContract` ADD CONSTRAINT `ManpowerContract_sourceProposalVersionId_fkey` FOREIGN KEY (`sourceProposalVersionId`) REFERENCES `PreContractProposalVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerClientDocument` ADD CONSTRAINT `ManpowerClientDocument_clientResponseId_fkey` FOREIGN KEY (`clientResponseId`) REFERENCES `PreContractClientResponse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerClientDocument` ADD CONSTRAINT `ManpowerClientDocument_proposalVersionId_fkey` FOREIGN KEY (`proposalVersionId`) REFERENCES `PreContractProposalVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreContractClientResponse` ADD CONSTRAINT `PreContractClientResponse_proposalId_fkey` FOREIGN KEY (`proposalId`) REFERENCES `PreContractProposal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreContractClientResponse` ADD CONSTRAINT `PreContractClientResponse_proposalVersionId_fkey` FOREIGN KEY (`proposalVersionId`) REFERENCES `PreContractProposalVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

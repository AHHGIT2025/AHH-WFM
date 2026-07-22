-- AlterTable ManpowerContract
ALTER TABLE `ManpowerContract`
    ADD COLUMN `contractType` VARCHAR(191) NOT NULL DEFAULT 'PERMANENT',
    ADD COLUMN `billingBasis` VARCHAR(191) NULL,
    ADD COLUMN `serviceStartAt` DATETIME(3) NULL,
    ADD COLUMN `serviceEndAt` DATETIME(3) NULL,
    ADD COLUMN `eventVenue` VARCHAR(191) NULL,
    ADD COLUMN `eventDetails` TEXT NULL,
    ADD COLUMN `mobilisationStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN `siteId` VARCHAR(191) NULL;

-- AlterTable ContractManpowerRequirement
ALTER TABLE `ContractManpowerRequirement`
    ADD COLUMN `focStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_APPLICABLE',
    ADD COLUMN `billingEligible` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `preFocUnitPrice` DOUBLE NULL,
    ADD COLUMN `preFocLineTotal` DOUBLE NULL,
    ADD COLUMN `focRequestedById` VARCHAR(191) NULL,
    ADD COLUMN `focRequestReason` TEXT NULL,
    ADD COLUMN `focRequestedAt` DATETIME(3) NULL,
    ADD COLUMN `focApprovedById` VARCHAR(191) NULL,
    ADD COLUMN `focApprovalReason` TEXT NULL,
    ADD COLUMN `focApprovedAt` DATETIME(3) NULL,
    ADD COLUMN `focRejectedById` VARCHAR(191) NULL,
    ADD COLUMN `focRejectionReason` TEXT NULL,
    ADD COLUMN `focRejectedAt` DATETIME(3) NULL,
    ADD COLUMN `focRevokedById` VARCHAR(191) NULL,
    ADD COLUMN `focRevocationReason` TEXT NULL,
    ADD COLUMN `focRevokedAt` DATETIME(3) NULL;

-- AddForeignKeys
ALTER TABLE `ManpowerContract` ADD CONSTRAINT `ManpowerContract_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ContractManpowerRequirement` ADD CONSTRAINT `ContractManpowerRequirement_focRequestedById_fkey` FOREIGN KEY (`focRequestedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ContractManpowerRequirement` ADD CONSTRAINT `ContractManpowerRequirement_focApprovedById_fkey` FOREIGN KEY (`focApprovedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ContractManpowerRequirement` ADD CONSTRAINT `ContractManpowerRequirement_focRejectedById_fkey` FOREIGN KEY (`focRejectedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ContractManpowerRequirement` ADD CONSTRAINT `ContractManpowerRequirement_focRevokedById_fkey` FOREIGN KEY (`focRevokedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `ManpowerContract` ADD COLUMN `renewalOfContractId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ManpowerContractRenewalCase` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `caseNumber` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'UNDER_REVIEW',
    `reviewWindowDays` INTEGER NULL,
    `noticePeriodDays` INTEGER NULL,
    `targetStartDate` DATETIME(3) NULL,
    `targetEndDate` DATETIME(3) NULL,
    `decision` VARCHAR(191) NULL,
    `decisionDate` DATETIME(3) NULL,
    `decisionReason` VARCHAR(191) NULL,
    `decisionNotes` VARCHAR(191) NULL,
    `resultingContractId` VARCHAR(191) NULL,
    `resultingAddendumId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdByName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManpowerContractRenewalCase_caseNumber_key`(`caseNumber`),
    INDEX `ManpowerContractRenewalCase_contractId_idx`(`contractId`),
    INDEX `ManpowerContractRenewalCase_status_idx`(`status`),
    INDEX `ManpowerContractRenewalCase_operationType_idx`(`operationType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `ManpowerContract_renewalOfContractId_key` ON `ManpowerContract`(`renewalOfContractId`);

-- AddForeignKey
ALTER TABLE `ManpowerContract` ADD CONSTRAINT `ManpowerContract_renewalOfContractId_fkey` FOREIGN KEY (`renewalOfContractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerContractRenewalCase` ADD CONSTRAINT `ManpowerContractRenewalCase_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

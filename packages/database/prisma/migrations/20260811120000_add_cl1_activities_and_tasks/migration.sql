-- CreateTable
CREATE TABLE `CommercialActivity` (
    `id` VARCHAR(191) NOT NULL,
    `activityType` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `interactionDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `direction` VARCHAR(191) NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `durationMinutes` INTEGER NULL,
    `callOutcome` VARCHAR(191) NULL,
    `meetingLocation` VARCHAR(191) NULL,
    `meetingLink` VARCHAR(191) NULL,
    `attendees` TEXT NULL,
    `externalProvider` VARCHAR(191) NULL,
    `externalItemId` VARCHAR(191) NULL,
    `externalWebLink` VARCHAR(191) NULL,
    `prospectClientId` VARCHAR(191) NULL,
    `preContractCaseId` VARCHAR(191) NULL,
    `contractId` VARCHAR(191) NULL,
    `addendumId` VARCHAR(191) NULL,
    `renewalCaseId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdByName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CommercialActivity_externalProvider_externalItemId_key`(`externalProvider`, `externalItemId`),
    INDEX `CommercialActivity_contractId_idx`(`contractId`),
    INDEX `CommercialActivity_prospectClientId_idx`(`prospectClientId`),
    INDEX `CommercialActivity_preContractCaseId_idx`(`preContractCaseId`),
    INDEX `CommercialActivity_activityType_idx`(`activityType`),
    INDEX `CommercialActivity_companyId_idx`(`companyId`),
    INDEX `CommercialActivity_operationType_idx`(`operationType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommercialTask` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `dueAt` DATETIME(3) NULL,
    `reminderAt` DATETIME(3) NULL,
    `reminderSent` BOOLEAN NOT NULL DEFAULT false,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `assignedToId` VARCHAR(191) NULL,
    `assignedToName` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `prospectClientId` VARCHAR(191) NULL,
    `preContractCaseId` VARCHAR(191) NULL,
    `contractId` VARCHAR(191) NULL,
    `addendumId` VARCHAR(191) NULL,
    `renewalCaseId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdByName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CommercialTask_contractId_idx`(`contractId`),
    INDEX `CommercialTask_assignedToId_idx`(`assignedToId`),
    INDEX `CommercialTask_status_idx`(`status`),
    INDEX `CommercialTask_priority_idx`(`priority`),
    INDEX `CommercialTask_dueAt_idx`(`dueAt`),
    INDEX `CommercialTask_companyId_idx`(`companyId`),
    INDEX `CommercialTask_operationType_idx`(`operationType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CommercialActivity` ADD CONSTRAINT `CommercialActivity_prospectClientId_fkey` FOREIGN KEY (`prospectClientId`) REFERENCES `ManpowerClient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommercialActivity` ADD CONSTRAINT `CommercialActivity_preContractCaseId_fkey` FOREIGN KEY (`preContractCaseId`) REFERENCES `PreContractCase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommercialActivity` ADD CONSTRAINT `CommercialActivity_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommercialActivity` ADD CONSTRAINT `CommercialActivity_addendumId_fkey` FOREIGN KEY (`addendumId`) REFERENCES `ManpowerContractAddendum`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommercialActivity` ADD CONSTRAINT `CommercialActivity_renewalCaseId_fkey` FOREIGN KEY (`renewalCaseId`) REFERENCES `ManpowerContractRenewalCase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommercialTask` ADD CONSTRAINT `CommercialTask_prospectClientId_fkey` FOREIGN KEY (`prospectClientId`) REFERENCES `ManpowerClient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommercialTask` ADD CONSTRAINT `CommercialTask_preContractCaseId_fkey` FOREIGN KEY (`preContractCaseId`) REFERENCES `PreContractCase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommercialTask` ADD CONSTRAINT `CommercialTask_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommercialTask` ADD CONSTRAINT `CommercialTask_addendumId_fkey` FOREIGN KEY (`addendumId`) REFERENCES `ManpowerContractAddendum`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommercialTask` ADD CONSTRAINT `CommercialTask_renewalCaseId_fkey` FOREIGN KEY (`renewalCaseId`) REFERENCES `ManpowerContractRenewalCase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

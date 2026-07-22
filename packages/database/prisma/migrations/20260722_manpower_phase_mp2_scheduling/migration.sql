-- CreateTable
CREATE TABLE `RosterRequirementSlot` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `externalVenueSnapshot` TEXT NULL,
    `locationKey` VARCHAR(191) NOT NULL,
    `contractRequirementId` VARCHAR(191) NOT NULL,
    `addendumId` VARCHAR(191) NULL,
    `addendumLineItemId` VARCHAR(191) NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `sourceEffectiveFrom` DATE NOT NULL,
    `sourceEffectiveTo` DATE NULL,
    `sourceVersion` INTEGER NOT NULL DEFAULT 1,
    `businessDate` DATE NOT NULL,
    `shiftRequirementId` VARCHAR(191) NULL,
    `shiftKey` VARCHAR(191) NOT NULL,
    `slotIndex` INTEGER NOT NULL,
    `generationKey` VARCHAR(191) NOT NULL,
    `snapshotPosition` VARCHAR(191) NOT NULL,
    `snapshotShiftName` VARCHAR(191) NOT NULL,
    `snapshotStartTime` VARCHAR(191) NOT NULL,
    `snapshotEndTime` VARCHAR(191) NOT NULL,
    `fulfillmentStatus` VARCHAR(191) NOT NULL DEFAULT 'VACANT',
    `scheduleStatus` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `rowVersion` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RosterRequirementSlot_generationKey_key`(`generationKey`),
    INDEX `RosterRequirementSlot_contractId_idx`(`contractId`),
    INDEX `RosterRequirementSlot_projectId_idx`(`projectId`),
    INDEX `RosterRequirementSlot_siteId_idx`(`siteId`),
    INDEX `RosterRequirementSlot_businessDate_idx`(`businessDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RosterSlotAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `slotId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `assignedRosterType` VARCHAR(191) NOT NULL DEFAULT 'PRIMARY',
    `historyStatus` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `assignedById` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `unassignedById` VARCHAR(191) NULL,
    `unassignedAt` DATETIME(3) NULL,
    `unassignmentReason` TEXT NULL,
    `validationSnapshot` JSON NULL,
    `legacyShiftAssignmentId` VARCHAR(191) NULL,
    `legacyDeploymentId` VARCHAR(191) NULL,
    `syncStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `lastSyncedAt` DATETIME(3) NULL,
    `syncError` TEXT NULL,
    `rowVersion` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RosterSlotAssignment_slotId_idx`(`slotId`),
    INDEX `RosterSlotAssignment_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RosterPublication` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `publicationVersion` INTEGER NOT NULL DEFAULT 1,
    `publishedById` VARCHAR(191) NOT NULL,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RosterPublicationSlot` (
    `id` VARCHAR(191) NOT NULL,
    `publicationId` VARCHAR(191) NOT NULL,
    `slotId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NULL,
    `employeeCode` VARCHAR(191) NULL,
    `employeeName` VARCHAR(191) NULL,
    `position` VARCHAR(191) NOT NULL,
    `shiftName` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `businessDate` DATE NOT NULL,
    `assignmentStatus` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RosterPlanningException` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `exceptionType` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL DEFAULT 'WARNING',
    `message` TEXT NOT NULL,
    `details` JSON NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `resolvedById` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RosterPlanningException_contractId_idx`(`contractId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerSchedulingPeriodLock` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `lockedById` VARCHAR(191) NULL,
    `lockedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManpowerSchedulingPeriodLock_operationType_period_key`(`operationType`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RosterRequirementSlot` ADD CONSTRAINT `RosterRequirementSlot_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterRequirementSlot` ADD CONSTRAINT `RosterRequirementSlot_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterRequirementSlot` ADD CONSTRAINT `RosterRequirementSlot_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ManpowerProject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterRequirementSlot` ADD CONSTRAINT `RosterRequirementSlot_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterRequirementSlot` ADD CONSTRAINT `RosterRequirementSlot_contractRequirementId_fkey` FOREIGN KEY (`contractRequirementId`) REFERENCES `ContractManpowerRequirement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterSlotAssignment` ADD CONSTRAINT `RosterSlotAssignment_slotId_fkey` FOREIGN KEY (`slotId`) REFERENCES `RosterRequirementSlot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterSlotAssignment` ADD CONSTRAINT `RosterSlotAssignment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterSlotAssignment` ADD CONSTRAINT `RosterSlotAssignment_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterSlotAssignment` ADD CONSTRAINT `RosterSlotAssignment_unassignedById_fkey` FOREIGN KEY (`unassignedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterPublication` ADD CONSTRAINT `RosterPublication_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterPublication` ADD CONSTRAINT `RosterPublication_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterPublication` ADD CONSTRAINT `RosterPublication_publishedById_fkey` FOREIGN KEY (`publishedById`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterPublicationSlot` ADD CONSTRAINT `RosterPublicationSlot_publicationId_fkey` FOREIGN KEY (`publicationId`) REFERENCES `RosterPublication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterPublicationSlot` ADD CONSTRAINT `RosterPublicationSlot_slotId_fkey` FOREIGN KEY (`slotId`) REFERENCES `RosterRequirementSlot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterPlanningException` ADD CONSTRAINT `RosterPlanningException_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterPlanningException` ADD CONSTRAINT `RosterPlanningException_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerSchedulingPeriodLock` ADD CONSTRAINT `ManpowerSchedulingPeriodLock_lockedById_fkey` FOREIGN KEY (`lockedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

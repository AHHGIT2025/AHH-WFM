-- AlterTable RosterPublication
ALTER TABLE `RosterPublication`
    ADD COLUMN `seriesKey` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `activeSeriesKey` VARCHAR(191) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `revisionReason` TEXT NULL,
    ADD COLUMN `supersedesPublicationId` VARCHAR(191) NULL,
    ADD COLUMN `supersededAt` DATETIME(3) NULL,
    ADD COLUMN `cancelledById` VARCHAR(191) NULL,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `cancellationReason` TEXT NULL;

-- Backfill seriesKey for existing RosterPublication rows
UPDATE `RosterPublication` 
SET `seriesKey` = CONCAT(
    `operationType`, ':',
    `contractId`, ':',
    IF(`siteId` IS NOT NULL, CONCAT('site:', `siteId`), 'all_sites'), ':',
    DATE_FORMAT(`startDate`, '%Y-%m-%d'), ':',
    DATE_FORMAT(`endDate`, '%Y-%m-%d')
)
WHERE `seriesKey` = '';

-- Backfill activeSeriesKey for existing active RosterPublication rows
UPDATE `RosterPublication`
SET `activeSeriesKey` = `seriesKey`
WHERE `status` = 'ACTIVE' AND `seriesKey` != '';

-- AlterTable RosterPublicationSlot
ALTER TABLE `RosterPublicationSlot`
    ADD COLUMN `snapshotKey` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `sourceAssignmentId` VARCHAR(191) NULL,
    ADD COLUMN `sourceAssignmentRole` VARCHAR(191) NOT NULL DEFAULT 'UNFILLED',
    ADD COLUMN `sourcePlanningExceptionId` VARCHAR(191) NULL,
    ADD COLUMN `coverageType` VARCHAR(191) NOT NULL DEFAULT 'PRIMARY_DUTY';

-- Backfill snapshotKey for existing RosterPublicationSlot rows
UPDATE `RosterPublicationSlot`
SET `snapshotKey` = CONCAT('PUB_SLOT:', `publicationId`, ':', `slotId`)
WHERE `snapshotKey` = '';

-- CreateTable RosterChangeRequest
CREATE TABLE `RosterChangeRequest` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `basePublicationId` VARCHAR(191) NOT NULL,
    `basePublicationVersion` INTEGER NOT NULL,
    `publicationSlotId` VARCHAR(191) NOT NULL,
    `slotId` VARCHAR(191) NOT NULL,
    `primaryAssignmentId` VARCHAR(191) NULL,
    `activeRequestKey` VARCHAR(191) NULL,
    `changeType` VARCHAR(191) NOT NULL,
    `targetEmployeeId` VARCHAR(191) NULL,
    `proposedShiftName` VARCHAR(191) NULL,
    `proposedStartTime` VARCHAR(191) NULL,
    `proposedEndTime` VARCHAR(191) NULL,
    `beforeSnapshot` JSON NOT NULL,
    `proposedSnapshot` JSON NOT NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `requestedById` VARCHAR(191) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNotes` TEXT NULL,
    `selfApprovalOverride` BOOLEAN NOT NULL DEFAULT false,
    `selfApprovalReason` TEXT NULL,
    `resultingPublicationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RosterChangeRequest_activeRequestKey_key`(`activeRequestKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable RosterSlotAcknowledgment
CREATE TABLE `RosterSlotAcknowledgment` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `publicationId` VARCHAR(191) NOT NULL,
    `publicationVersion` INTEGER NOT NULL,
    `publicationSlotId` VARCHAR(191) NOT NULL,
    `assignmentId` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `acknowledgedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deviceGeneratedAt` DATETIME(3) NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submittedOffline` BOOLEAN NOT NULL DEFAULT false,
    `clientRequestId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RosterSlotAcknowledgment_clientRequestId_key`(`clientRequestId`),
    UNIQUE INDEX `RosterSlotAcknowledgment_publicationSlotId_employeeId_key`(`publicationSlotId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable ManpowerPublicationScopeLock
CREATE TABLE `ManpowerPublicationScopeLock` (
    `id` VARCHAR(191) NOT NULL,
    `lockKey` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `acquiredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManpowerPublicationScopeLock_lockKey_key`(`lockKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateUniqueIndexes
CREATE UNIQUE INDEX `RosterPublication_activeSeriesKey_key` ON `RosterPublication`(`activeSeriesKey`);
CREATE UNIQUE INDEX `RosterPublication_supersedesPublicationId_key` ON `RosterPublication`(`supersedesPublicationId`);
CREATE UNIQUE INDEX `RosterPublication_seriesKey_publicationVersion_key` ON `RosterPublication`(`seriesKey`, `publicationVersion`);
CREATE UNIQUE INDEX `RosterPublicationSlot_publicationId_snapshotKey_key` ON `RosterPublicationSlot`(`publicationId`, `snapshotKey`);

-- AddIndexes
CREATE INDEX `RosterPublication_seriesKey_idx` ON `RosterPublication`(`seriesKey`);
CREATE INDEX `RosterPublication_status_idx` ON `RosterPublication`(`status`);
CREATE INDEX `RosterPublicationSlot_publicationId_slotId_idx` ON `RosterPublicationSlot`(`publicationId`, `slotId`);

CREATE INDEX `RosterChangeRequest_contractId_idx` ON `RosterChangeRequest`(`contractId`);
CREATE INDEX `RosterChangeRequest_basePublicationId_idx` ON `RosterChangeRequest`(`basePublicationId`);
CREATE INDEX `RosterChangeRequest_publicationSlotId_idx` ON `RosterChangeRequest`(`publicationSlotId`);
CREATE INDEX `RosterChangeRequest_slotId_idx` ON `RosterChangeRequest`(`slotId`);
CREATE INDEX `RosterChangeRequest_status_idx` ON `RosterChangeRequest`(`status`);
CREATE INDEX `RosterChangeRequest_requestedById_idx` ON `RosterChangeRequest`(`requestedById`);
CREATE INDEX `RosterChangeRequest_reviewedById_idx` ON `RosterChangeRequest`(`reviewedById`);

CREATE INDEX `RosterSlotAcknowledgment_publicationId_idx` ON `RosterSlotAcknowledgment`(`publicationId`);
CREATE INDEX `RosterSlotAcknowledgment_publicationSlotId_idx` ON `RosterSlotAcknowledgment`(`publicationSlotId`);
CREATE INDEX `RosterSlotAcknowledgment_employeeId_idx` ON `RosterSlotAcknowledgment`(`employeeId`);

-- AddForeignKeys
ALTER TABLE `RosterPublication` ADD CONSTRAINT `RosterPublication_supersedesPublicationId_fkey` FOREIGN KEY (`supersedesPublicationId`) REFERENCES `RosterPublication`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RosterPublication` ADD CONSTRAINT `RosterPublication_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `RosterChangeRequest` ADD CONSTRAINT `RosterChangeRequest_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RosterChangeRequest` ADD CONSTRAINT `RosterChangeRequest_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RosterChangeRequest` ADD CONSTRAINT `RosterChangeRequest_basePublicationId_fkey` FOREIGN KEY (`basePublicationId`) REFERENCES `RosterPublication`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RosterChangeRequest` ADD CONSTRAINT `RosterChangeRequest_publicationSlotId_fkey` FOREIGN KEY (`publicationSlotId`) REFERENCES `RosterPublicationSlot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RosterChangeRequest` ADD CONSTRAINT `RosterChangeRequest_slotId_fkey` FOREIGN KEY (`slotId`) REFERENCES `RosterRequirementSlot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RosterChangeRequest` ADD CONSTRAINT `RosterChangeRequest_primaryAssignmentId_fkey` FOREIGN KEY (`primaryAssignmentId`) REFERENCES `RosterSlotAssignment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RosterChangeRequest` ADD CONSTRAINT `RosterChangeRequest_targetEmployeeId_fkey` FOREIGN KEY (`targetEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RosterChangeRequest` ADD CONSTRAINT `RosterChangeRequest_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RosterChangeRequest` ADD CONSTRAINT `RosterChangeRequest_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RosterChangeRequest` ADD CONSTRAINT `RosterChangeRequest_resultingPublicationId_fkey` FOREIGN KEY (`resultingPublicationId`) REFERENCES `RosterPublication`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `RosterSlotAcknowledgment` ADD CONSTRAINT `RosterSlotAcknowledgment_publicationId_fkey` FOREIGN KEY (`publicationId`) REFERENCES `RosterPublication`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RosterSlotAcknowledgment` ADD CONSTRAINT `RosterSlotAcknowledgment_publicationSlotId_fkey` FOREIGN KEY (`publicationSlotId`) REFERENCES `RosterPublicationSlot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RosterSlotAcknowledgment` ADD CONSTRAINT `RosterSlotAcknowledgment_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `RosterSlotAssignment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RosterSlotAcknowledgment` ADD CONSTRAINT `RosterSlotAcknowledgment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

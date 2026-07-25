-- CreateTable ReconciliationGracePeriodConfig
CREATE TABLE `ReconciliationGracePeriodConfig` (
    `id` VARCHAR(191) NOT NULL,
    `scopeType` VARCHAR(191) NOT NULL,
    `scopeKey` VARCHAR(191) NOT NULL,
    `configVersion` INTEGER NOT NULL DEFAULT 1,
    `activeScopeKey` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `operationType` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `shiftKey` VARCHAR(191) NULL,
    `gracePeriodMinutes` INTEGER NOT NULL DEFAULT 15,
    `noCheckInThresholdMinutes` INTEGER NOT NULL DEFAULT 30,
    `earlyCheckInAllowanceMinutes` INTEGER NOT NULL DEFAULT 60,
    `syncDelayThresholdMinutes` INTEGER NOT NULL DEFAULT 30,
    `attendanceExempt` BOOLEAN NOT NULL DEFAULT false,
    `effectiveFrom` DATETIME(3) NULL,
    `effectiveTo` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `supersededAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReconciliationGracePeriodConfig_activeScopeKey_key`(`activeScopeKey`),
    INDEX `ReconciliationGracePeriodConfig_scopeType_status_idx`(`scopeType`, `status`),
    INDEX `ReconciliationGracePeriodConfig_operationType_idx`(`operationType`),
    INDEX `ReconciliationGracePeriodConfig_contractId_idx`(`contractId`),
    INDEX `ReconciliationGracePeriodConfig_projectId_idx`(`projectId`),
    INDEX `ReconciliationGracePeriodConfig_siteId_idx`(`siteId`),
    UNIQUE INDEX `ReconciliationGracePeriodConfig_scopeKey_configVersion_key`(`scopeKey`, `configVersion`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable ManpowerReconciliationRun
CREATE TABLE `ManpowerReconciliationRun` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `businessDate` DATE NOT NULL,
    `windowStartUtc` DATETIME(3) NOT NULL,
    `windowEndUtc` DATETIME(3) NOT NULL,
    `runType` VARCHAR(191) NOT NULL,
    `runStatus` VARCHAR(191) NOT NULL DEFAULT 'RUNNING',
    `scopeOutcome` VARCHAR(191) NOT NULL DEFAULT 'PROCESSED',
    `publicationId` VARCHAR(191) NULL,
    `workerInstanceId` VARCHAR(191) NOT NULL,
    `watermarkBefore` DATETIME(3) NULL,
    `watermarkAfter` DATETIME(3) NULL,
    `processedCount` INTEGER NOT NULL DEFAULT 0,
    `onTimeCount` INTEGER NOT NULL DEFAULT 0,
    `lateCount` INTEGER NOT NULL DEFAULT 0,
    `noCheckInCount` INTEGER NOT NULL DEFAULT 0,
    `suppressedCount` INTEGER NOT NULL DEFAULT 0,
    `errorCount` INTEGER NOT NULL DEFAULT 0,
    `errorSummary` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ManpowerReconciliationRun_operationType_businessDate_idx`(`operationType`, `businessDate`),
    INDEX `ManpowerReconciliationRun_runStatus_idx`(`runStatus`),
    INDEX `ManpowerReconciliationRun_scopeOutcome_idx`(`scopeOutcome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable AttendanceRosterReconciliation
CREATE TABLE `AttendanceRosterReconciliation` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `contractCode` VARCHAR(191) NOT NULL,
    `contractTitle` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `projectCode` VARCHAR(191) NULL,
    `projectName` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `siteCode` VARCHAR(191) NULL,
    `siteName` VARCHAR(191) NULL,
    `slotId` VARCHAR(191) NOT NULL,
    `expectedPublicationId` VARCHAR(191) NULL,
    `expectedPublicationVersion` INTEGER NULL,
    `expectedPublicationSlotId` VARCHAR(191) NULL,
    `expectedSnapshotKey` VARCHAR(191) NULL,
    `expectedAssignmentId` VARCHAR(191) NULL,
    `expectedAssignmentRole` VARCHAR(191) NOT NULL DEFAULT 'PRIMARY',
    `expectedEmployeeId` VARCHAR(191) NOT NULL,
    `expectedEmployeeCode` VARCHAR(191) NOT NULL,
    `expectedEmployeeName` VARCHAR(191) NOT NULL,
    `expectedShiftCode` VARCHAR(191) NULL,
    `expectedPosition` VARCHAR(191) NULL,
    `expectedSourceType` VARCHAR(191) NOT NULL,
    `suppressionSourceType` VARCHAR(191) NULL,
    `attendanceRecordId` VARCHAR(191) NULL,
    `rawCheckInUtc` DATETIME(3) NULL,
    `originalCheckInUtc` DATETIME(3) NULL,
    `serverReceivedUtc` DATETIME(3) NULL,
    `selectedPunchUtc` DATETIME(3) NULL,
    `punchTimestampSource` VARCHAR(191) NULL,
    `businessDate` DATE NOT NULL,
    `shiftKey` VARCHAR(191) NOT NULL,
    `scheduledStartUtc` DATETIME(3) NOT NULL,
    `scheduledEndUtc` DATETIME(3) NOT NULL,
    `actualCheckInUtc` DATETIME(3) NULL,
    `actualCheckOutUtc` DATETIME(3) NULL,
    `resolvedConfigId` VARCHAR(191) NULL,
    `resolvedGracePeriodMinutes` INTEGER NOT NULL,
    `resolvedNoCheckInThresholdMinutes` INTEGER NOT NULL,
    `resolvedEarlyAllowanceMinutes` INTEGER NOT NULL,
    `resolvedSyncThresholdMinutes` INTEGER NOT NULL,
    `lateMinutes` INTEGER NOT NULL DEFAULT 0,
    `detectionOutcome` VARCHAR(191) NOT NULL,
    `workflowStatus` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `resolution` VARCHAR(191) NOT NULL DEFAULT 'NOT_APPLICABLE',
    `suppressionReason` VARCHAR(191) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNotes` TEXT NULL,
    `canonicalIdentity` TEXT NOT NULL,
    `reconciliationKey` VARCHAR(64) NOT NULL,
    `rowVersion` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AttendanceRosterReconciliation_reconciliationKey_key`(`reconciliationKey`),
    INDEX `AttendanceRosterReconciliation_operationType_businessDate_idx`(`operationType`, `businessDate`),
    INDEX `AttendanceRosterReconciliation_contractId_businessDate_idx`(`contractId`, `businessDate`),
    INDEX `AttendanceRosterReconciliation_siteId_businessDate_idx`(`siteId`, `businessDate`),
    INDEX `AttendanceRosterRecon_employee_date_idx`(`expectedEmployeeId`, `businessDate`),
    INDEX `AttendanceRosterReconciliation_detectionOutcome_idx`(`detectionOutcome`),
    INDEX `AttendanceRosterReconciliation_workflowStatus_idx`(`workflowStatus`),
    INDEX `AttendanceRosterReconciliation_resolution_idx`(`resolution`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable ManpowerReconciliationScopeLock
CREATE TABLE `ManpowerReconciliationScopeLock` (
    `id` VARCHAR(191) NOT NULL,
    `lockKey` VARCHAR(191) NOT NULL,
    `ownerToken` VARCHAR(191) NOT NULL,
    `leaseVersion` INTEGER NOT NULL DEFAULT 1,
    `operationType` VARCHAR(191) NOT NULL,
    `businessDate` DATE NOT NULL,
    `acquiredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `renewedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ManpowerReconciliationScopeLock_lockKey_key`(`lockKey`),
    INDEX `ManpowerReconciliationScopeLock_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReconciliationGracePeriodConfig` ADD CONSTRAINT `ReconciliationGracePeriodConfig_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReconciliationGracePeriodConfig` ADD CONSTRAINT `ReconciliationGracePeriodConfig_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ManpowerProject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReconciliationGracePeriodConfig` ADD CONSTRAINT `ReconciliationGracePeriodConfig_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReconciliationGracePeriodConfig` ADD CONSTRAINT `ReconciliationGracePeriodConfig_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReconciliationGracePeriodConfig` ADD CONSTRAINT `ReconciliationGracePeriodConfig_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerReconciliationRun` ADD CONSTRAINT `ManpowerReconciliationRun_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerReconciliationRun` ADD CONSTRAINT `ManpowerReconciliationRun_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerReconciliationRun` ADD CONSTRAINT `ManpowerReconciliationRun_publicationId_fkey` FOREIGN KEY (`publicationId`) REFERENCES `RosterPublication`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRosterReconciliation` ADD CONSTRAINT `AttendanceRosterReconciliation_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRosterReconciliation` ADD CONSTRAINT `AttendanceRosterReconciliation_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ManpowerProject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRosterReconciliation` ADD CONSTRAINT `AttendanceRosterReconciliation_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRosterReconciliation` ADD CONSTRAINT `AttendanceRosterReconciliation_slotId_fkey` FOREIGN KEY (`slotId`) REFERENCES `RosterRequirementSlot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRosterReconciliation` ADD CONSTRAINT `AttendanceRosterReconciliation_expectedPublicationId_fkey` FOREIGN KEY (`expectedPublicationId`) REFERENCES `RosterPublication`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRosterReconciliation` ADD CONSTRAINT `AttendanceRosterReconciliation_expectedPublicationSlotId_fkey` FOREIGN KEY (`expectedPublicationSlotId`) REFERENCES `RosterPublicationSlot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRosterReconciliation` ADD CONSTRAINT `AttendanceRosterReconciliation_expectedEmployeeId_fkey` FOREIGN KEY (`expectedEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRosterReconciliation` ADD CONSTRAINT `AttendanceRosterReconciliation_attendanceRecordId_fkey` FOREIGN KEY (`attendanceRecordId`) REFERENCES `AttendanceRecord`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRosterReconciliation` ADD CONSTRAINT `AttendanceRosterReconciliation_resolvedConfigId_fkey` FOREIGN KEY (`resolvedConfigId`) REFERENCES `ReconciliationGracePeriodConfig`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRosterReconciliation` ADD CONSTRAINT `AttendanceRosterReconciliation_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

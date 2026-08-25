-- CreateTable
CREATE TABLE `attendance_import_batches` (
    `id` VARCHAR(191) NOT NULL,
    `batchNumber` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `operationType` VARCHAR(191) NULL,
    `attendancePeriodFrom` DATE NULL,
    `attendancePeriodTo` DATE NULL,
    `sourceType` VARCHAR(191) NOT NULL DEFAULT 'FILE_UPLOAD',
    `originalFileName` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NULL,
    `fileMimeType` VARCHAR(191) NULL,
    `fileHash` VARCHAR(191) NULL,
    `recordCount` INTEGER NOT NULL DEFAULT 0,
    `validCount` INTEGER NOT NULL DEFAULT 0,
    `warningCount` INTEGER NOT NULL DEFAULT 0,
    `errorCount` INTEGER NOT NULL DEFAULT 0,
    `duplicateCount` INTEGER NOT NULL DEFAULT 0,
    `unmatchedCount` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'UPLOADED',
    `uploadedById` VARCHAR(191) NULL,
    `uploadedByName` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validationStartedAt` DATETIME(3) NULL,
    `validationCompletedAt` DATETIME(3) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedByName` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `remarks` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `attendance_import_batches_batchNumber_key`(`batchNumber`),
    INDEX `attendance_import_batches_companyId_status_idx`(`companyId`, `status`),
    INDEX `attendance_import_batches_company_period_idx`(`companyId`, `attendancePeriodFrom`, `attendancePeriodTo`),
    INDEX `attendance_import_batches_status_idx`(`status`),
    INDEX `attendance_import_batches_sourceType_idx`(`sourceType`),
    INDEX `attendance_import_batches_fileHash_idx`(`fileHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_import_rows` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `sourceRowNumber` INTEGER NOT NULL,
    `rawPayload` JSON NULL,
    `rowFingerprint` VARCHAR(191) NULL,
    `rawAttendanceDate` VARCHAR(191) NULL,
    `rawEmployeeCode` VARCHAR(191) NULL,
    `rawEmployeeName` VARCHAR(191) NULL,
    `rawCompany` VARCHAR(191) NULL,
    `rawSite` VARCHAR(191) NULL,
    `rawContract` VARCHAR(191) NULL,
    `rawShift` VARCHAR(191) NULL,
    `rawPlannedStart` VARCHAR(191) NULL,
    `rawPlannedEnd` VARCHAR(191) NULL,
    `rawActualTimeIn` VARCHAR(191) NULL,
    `rawActualTimeOut` VARCHAR(191) NULL,
    `rawWorkedHours` VARCHAR(191) NULL,
    `rawOtHours` VARCHAR(191) NULL,
    `rawAttendanceStatus` VARCHAR(191) NULL,
    `rawLeaveType` VARCHAR(191) NULL,
    `rawReplacementEmployeeCode` VARCHAR(191) NULL,
    `rawAssignmentType` VARCHAR(191) NULL,
    `rawRemarks` TEXT NULL,
    `attendanceDate` DATE NULL,
    `actualTimeIn` DATETIME(3) NULL,
    `actualTimeOut` DATETIME(3) NULL,
    `plannedStartTime` VARCHAR(191) NULL,
    `plannedEndTime` VARCHAR(191) NULL,
    `workedHours` DOUBLE NULL,
    `otHours` DOUBLE NULL,
    `normalizedStatus` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `contractId` VARCHAR(191) NULL,
    `rosterRequirementSlotId` VARCHAR(191) NULL,
    `rosterSlotAssignmentId` VARCHAR(191) NULL,
    `existingAttendanceId` VARCHAR(191) NULL,
    `validationStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `validationMessages` JSON NULL,
    `isDuplicate` BOOLEAN NOT NULL DEFAULT false,
    `duplicateReason` TEXT NULL,
    `existingAttendanceSource` VARCHAR(191) NULL,
    `validationVersion` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `attendance_import_rows_batch_status_idx`(`batchId`, `validationStatus`),
    INDEX `attendance_import_rows_batch_row_idx`(`batchId`, `sourceRowNumber`),
    INDEX `attendance_import_rows_emp_date_idx`(`employeeId`, `attendanceDate`),
    INDEX `attendance_import_rows_company_date_idx`(`companyId`, `attendanceDate`),
    INDEX `attendance_import_rows_roster_asg_idx`(`rosterSlotAssignmentId`),
    INDEX `attendance_import_rows_existing_att_idx`(`existingAttendanceId`),
    INDEX `attendance_import_rows_fingerprint_idx`(`rowFingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attendance_import_batches` ADD CONSTRAINT `attendance_import_batches_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_batches` ADD CONSTRAINT `attendance_import_batches_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_batches` ADD CONSTRAINT `attendance_import_batches_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_rows` ADD CONSTRAINT `attendance_import_rows_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `attendance_import_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_rows` ADD CONSTRAINT `attendance_import_rows_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_rows` ADD CONSTRAINT `attendance_import_rows_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_rows` ADD CONSTRAINT `attendance_import_rows_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_rows` ADD CONSTRAINT `attendance_import_rows_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_rows` ADD CONSTRAINT `attendance_import_rows_rosterRequirementSlotId_fkey` FOREIGN KEY (`rosterRequirementSlotId`) REFERENCES `RosterRequirementSlot`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_rows` ADD CONSTRAINT `attendance_import_rows_rosterSlotAssignmentId_fkey` FOREIGN KEY (`rosterSlotAssignmentId`) REFERENCES `RosterSlotAssignment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_import_rows` ADD CONSTRAINT `attendance_import_rows_existingAttendanceId_fkey` FOREIGN KEY (`existingAttendanceId`) REFERENCES `AttendanceRecord`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

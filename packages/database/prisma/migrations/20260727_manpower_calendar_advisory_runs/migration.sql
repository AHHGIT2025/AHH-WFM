-- CreateTable
CREATE TABLE `ManpowerWorkCalendarProfile` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `workerCategory` VARCHAR(191) NOT NULL,
    `ordinaryDailyMinutes` INTEGER NULL,
    `ordinaryWeeklyMinutes` INTEGER NULL,
    `ramadanDailyMinutes` INTEGER NULL,
    `ramadanWeeklyMinutes` INTEGER NULL,
    `weeklyRestConfigType` VARCHAR(191) NOT NULL DEFAULT 'FIXED_DAY',
    `weeklyRestFixedDay` VARCHAR(191) NULL DEFAULT 'FRIDAY',
    `weeklyRestCustomSchedule` JSON NULL,
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NOT NULL,
    `sourceReference` VARCHAR(191) NULL,
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `supersedesProfileId` VARCHAR(191) NULL,
    `supersededAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManpowerWorkCalendarProfile_code_key`(`code`),
    INDEX `ManpowerWorkCalendarProfile_operationType_workerCategory_app_idx`(`operationType`, `workerCategory`, `approvalStatus`),
    INDEX `ManpowerWorkCalendarProfile_effectiveFrom_effectiveTo_idx`(`effectiveFrom`, `effectiveTo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerRamadanPeriod` (
    `id` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `sourceReference` VARCHAR(191) NULL,
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `supersedesPeriodId` VARCHAR(191) NULL,
    `supersededAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManpowerRamadanPeriod_year_key`(`year`),
    INDEX `ManpowerRamadanPeriod_year_approvalStatus_idx`(`year`, `approvalStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerHolidayCalendar` (
    `id` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `scope` ENUM('SECURITY_GUARDING', 'FACILITY_MANAGEMENT', 'BOTH') NOT NULL DEFAULT 'BOTH',
    `version` INTEGER NOT NULL DEFAULT 1,
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `supersedesCalendarId` VARCHAR(191) NULL,
    `supersededAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ManpowerHolidayCalendar_year_scope_approvalStatus_idx`(`year`, `scope`, `approvalStatus`),
    UNIQUE INDEX `ManpowerHolidayCalendar_year_scope_version_key`(`year`, `scope`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerHolidayDate` (
    `id` VARCHAR(191) NOT NULL,
    `calendarId` VARCHAR(191) NOT NULL,
    `holidayDate` DATE NOT NULL,
    `holidayCode` VARCHAR(191) NOT NULL,
    `holidayName` VARCHAR(191) NOT NULL,
    `holidayType` VARCHAR(191) NOT NULL DEFAULT 'NATIONAL',
    `operationType` VARCHAR(191) NOT NULL DEFAULT 'BOTH',
    `rosterOperational` BOOLEAN NOT NULL DEFAULT true,
    `payrollAdvisoryTreatment` VARCHAR(191) NOT NULL DEFAULT 'PUBLIC_HOLIDAY_WORKED',
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'APPROVED',
    `sourceReference` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ManpowerHolidayDate_holidayDate_operationType_idx`(`holidayDate`, `operationType`),
    UNIQUE INDEX `ManpowerHolidayDate_calendarId_holidayDate_operationType_key`(`calendarId`, `holidayDate`, `operationType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerBillingSupportRun` (
    `id` VARCHAR(191) NOT NULL,
    `runCode` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'CALCULATED', 'REVIEWED', 'LOCKED', 'EXPORTED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 1,
    `supersedesRunId` VARCHAR(191) NULL,
    `supersededAt` DATETIME(3) NULL,
    `calculatedBy` VARCHAR(191) NOT NULL,
    `calculatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `lockedBy` VARCHAR(191) NULL,
    `lockedAt` DATETIME(3) NULL,
    `filters` JSON NULL,
    `resultSummary` JSON NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManpowerBillingSupportRun_runCode_key`(`runCode`),
    INDEX `ManpowerBillingSupportRun_operationType_period_status_idx`(`operationType`, `period`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerBillingSupportLine` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `businessDate` DATE NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `clientNameSnapshot` VARCHAR(191) NULL,
    `contractId` VARCHAR(191) NULL,
    `contractCodeSnapshot` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `projectNameSnapshot` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `siteNameSnapshot` VARCHAR(191) NULL,
    `requirementSlotId` VARCHAR(191) NULL,
    `positionCategory` VARCHAR(191) NULL,
    `plannedManpower` INTEGER NOT NULL DEFAULT 0,
    `plannedPostMinutes` INTEGER NOT NULL DEFAULT 0,
    `assignedManpower` INTEGER NOT NULL DEFAULT 0,
    `verifiedPresentManpower` INTEGER NOT NULL DEFAULT 0,
    `verifiedAttendedMinutes` INTEGER NOT NULL DEFAULT 0,
    `coveredPostMinutes` INTEGER NOT NULL DEFAULT 0,
    `shortageCount` INTEGER NOT NULL DEFAULT 0,
    `unapprovedExtraCount` INTEGER NOT NULL DEFAULT 0,
    `approvedExtraCount` INTEGER NOT NULL DEFAULT 0,
    `relieverSubstitutionCount` INTEGER NOT NULL DEFAULT 0,
    `focRelieverMinutes` INTEGER NOT NULL DEFAULT 0,
    `billableAdvisoryQuantity` INTEGER NOT NULL DEFAULT 0,
    `billingBasis` VARCHAR(191) NOT NULL DEFAULT 'PLANNED_VS_ACTUAL',
    `warningCodes` JSON NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ManpowerBillingSupportLine_runId_businessDate_idx`(`runId`, `businessDate`),
    INDEX `ManpowerBillingSupportLine_clientId_contractId_siteId_idx`(`clientId`, `contractId`, `siteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerPayrollAdvisoryRun` (
    `id` VARCHAR(191) NOT NULL,
    `runCode` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'CALCULATED', 'REVIEWED', 'LOCKED', 'EXPORTED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
    `readiness` ENUM('READY_FOR_PAYROLL_REVIEW', 'NEEDS_ATTENDANCE_RECONCILIATION', 'NEEDS_OVERTIME_APPROVAL', 'NEEDS_HOLIDAY_REVIEW', 'NEEDS_ACTING_DUTY_APPROVAL', 'NEEDS_ALLOWANCE_APPROVAL', 'RAMADAN_RULE_NOT_CONFIGURED', 'PERIOD_LOCKED', 'DATA_INCOMPLETE') NOT NULL DEFAULT 'DATA_INCOMPLETE',
    `version` INTEGER NOT NULL DEFAULT 1,
    `supersedesRunId` VARCHAR(191) NULL,
    `supersededAt` DATETIME(3) NULL,
    `workCalendarProfileVersion` INTEGER NOT NULL DEFAULT 1,
    `holidayCalendarVersion` INTEGER NOT NULL DEFAULT 1,
    `calculatedBy` VARCHAR(191) NOT NULL,
    `calculatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `lockedBy` VARCHAR(191) NULL,
    `lockedAt` DATETIME(3) NULL,
    `filters` JSON NULL,
    `resultSummary` JSON NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManpowerPayrollAdvisoryRun_runCode_key`(`runCode`),
    INDEX `ManpowerPayrollAdvisoryRun_operationType_period_status_readi_idx`(`operationType`, `period`, `status`, `readiness`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerPayrollAdvisoryLine` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `employeeCodeSnapshot` VARCHAR(191) NOT NULL,
    `employeeNameSnapshot` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `siteNameSnapshot` VARCHAR(191) NULL,
    `regularWorkedDays` INTEGER NOT NULL DEFAULT 0,
    `regularVerifiedMinutes` INTEGER NOT NULL DEFAULT 0,
    `ramadanWorkedMinutes` INTEGER NOT NULL DEFAULT 0,
    `ramadanExcessCandidateMinutes` INTEGER NOT NULL DEFAULT 0,
    `overtimeCandidateMinutes` INTEGER NOT NULL DEFAULT 0,
    `publicHolidayWorkedDays` INTEGER NOT NULL DEFAULT 0,
    `publicHolidayWorkedMinutes` INTEGER NOT NULL DEFAULT 0,
    `weeklyRestWorkedDays` INTEGER NOT NULL DEFAULT 0,
    `weeklyRestWorkedMinutes` INTEGER NOT NULL DEFAULT 0,
    `actingDutyCandidateDays` INTEGER NOT NULL DEFAULT 0,
    `actingDutyCandidateMinutes` INTEGER NOT NULL DEFAULT 0,
    `siteAllowanceCandidateDays` INTEGER NOT NULL DEFAULT 0,
    `leaveDays` INTEGER NOT NULL DEFAULT 0,
    `absenceDays` INTEGER NOT NULL DEFAULT 0,
    `reconciliationStatus` VARCHAR(191) NOT NULL DEFAULT 'MATCHED',
    `readinessStatus` ENUM('READY_FOR_PAYROLL_REVIEW', 'NEEDS_ATTENDANCE_RECONCILIATION', 'NEEDS_OVERTIME_APPROVAL', 'NEEDS_HOLIDAY_REVIEW', 'NEEDS_ACTING_DUTY_APPROVAL', 'NEEDS_ALLOWANCE_APPROVAL', 'RAMADAN_RULE_NOT_CONFIGURED', 'PERIOD_LOCKED', 'DATA_INCOMPLETE') NOT NULL DEFAULT 'READY_FOR_PAYROLL_REVIEW',
    `advisoryClassifications` JSON NULL,
    `advisoryWarnings` JSON NULL,
    `evidenceReferences` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ManpowerPayrollAdvisoryLine_runId_employeeId_idx`(`runId`, `employeeId`),
    INDEX `ManpowerPayrollAdvisoryLine_employeeId_siteId_idx`(`employeeId`, `siteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ManpowerWorkCalendarProfile` ADD CONSTRAINT `ManpowerWorkCalendarProfile_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerHolidayCalendar` ADD CONSTRAINT `ManpowerHolidayCalendar_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerHolidayDate` ADD CONSTRAINT `ManpowerHolidayDate_calendarId_fkey` FOREIGN KEY (`calendarId`) REFERENCES `ManpowerHolidayCalendar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerBillingSupportLine` ADD CONSTRAINT `ManpowerBillingSupportLine_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `ManpowerBillingSupportRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerPayrollAdvisoryLine` ADD CONSTRAINT `ManpowerPayrollAdvisoryLine_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `ManpowerPayrollAdvisoryRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

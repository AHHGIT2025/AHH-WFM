-- CreateTable
CREATE TABLE `Employee` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `shiftId` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NULL,
    `profilePhotoUrl` VARCHAR(191) NULL,
    `profilePhotoUpdatedAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `employmentStatus` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `dutyStatus` VARCHAR(191) NOT NULL DEFAULT 'OFF_DUTY',
    `employeeCategory` VARCHAR(191) NOT NULL DEFAULT 'WHITE_COLLAR',
    `workAssignmentType` VARCHAR(191) NOT NULL DEFAULT 'OFFICE_BASED',
    `dateOfJoining` DATETIME(3) NULL,
    `qidNumber` VARCHAR(191) NULL,
    `qidExpiryDate` DATETIME(3) NULL,
    `passportNumber` VARCHAR(191) NULL,
    `passportExpiryDate` DATETIME(3) NULL,
    `passportIssueDate` DATETIME(3) NULL,
    `passportIssuingCountry` VARCHAR(191) NULL,
    `sponsor` VARCHAR(191) NULL,
    `hasAccommodation` BOOLEAN NOT NULL DEFAULT false,
    `hasItAssets` BOOLEAN NOT NULL DEFAULT false,
    `positionCategoryId` VARCHAR(191) NULL,
    `defaultProjectId` VARCHAR(191) NULL,
    `defaultSiteId` VARCHAR(191) NULL,
    `designationId` VARCHAR(191) NULL,
    `tradeClassificationId` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,
    `costCenterId` VARCHAR(191) NULL,
    `defaultLocationId` VARCHAR(191) NULL,
    `officeLocationId` VARCHAR(191) NULL,
    `isRelieverEligible` BOOLEAN NOT NULL DEFAULT false,
    `isStandbyEligible` BOOLEAN NOT NULL DEFAULT false,
    `defaultPunchLocationId` VARCHAR(191) NULL,
    `allowMultiplePunchLocations` BOOLEAN NOT NULL DEFAULT false,
    `allowOfficePunch` BOOLEAN NOT NULL DEFAULT true,
    `allowProjectSitePunch` BOOLEAN NOT NULL DEFAULT true,
    `allowOnCallPunch` BOOLEAN NOT NULL DEFAULT false,
    `allowOutOfZonePunch` BOOLEAN NOT NULL DEFAULT false,
    `requireOutOfZoneReview` BOOLEAN NOT NULL DEFAULT true,
    `geofenceRadiusOverrideMeters` DOUBLE NULL,
    `immediateSupervisorId` VARCHAR(191) NULL,
    `reportingManagerId` VARCHAR(191) NULL,
    `projectSupervisorId` VARCHAR(191) NULL,
    `siteSupervisorId` VARCHAR(191) NULL,
    `isSupervisor` BOOLEAN NOT NULL DEFAULT false,
    `supervisorScopeType` VARCHAR(191) NOT NULL DEFAULT 'DIRECT_REPORTS',
    `username` VARCHAR(191) NULL,
    `authMode` VARCHAR(191) NOT NULL DEFAULT 'LOCAL',
    `ssoProvider` VARCHAR(191) NULL,
    `ssoSubject` VARCHAR(191) NULL,
    `isLoginEnabled` BOOLEAN NOT NULL DEFAULT true,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `isLocked` BOOLEAN NOT NULL DEFAULT false,
    `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    `selfServiceEnabled` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `passwordUpdatedAt` DATETIME(3) NULL,
    `webAccessEnabled` BOOLEAN NOT NULL DEFAULT true,
    `mobileAccessEnabled` BOOLEAN NOT NULL DEFAULT true,
    `usernameStrategy` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `deactivatedAt` DATETIME(3) NULL,
    `operationType` VARCHAR(191) NOT NULL DEFAULT 'WHITE_COLLAR',
    `manpowerCategoryId` VARCHAR(191) NULL,

    UNIQUE INDEX `Employee_email_key`(`email`),
    UNIQUE INDEX `Employee_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Department` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Department_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceRecord` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `employeeName` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `checkIn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `checkOut` DATETIME(3) NULL,
    `originalCheckIn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `originalCheckOut` DATETIME(3) NULL,
    `lat` DOUBLE NOT NULL,
    `lng` DOUBLE NOT NULL,
    `device` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `locationName` VARCHAR(191) NOT NULL,
    `worksiteId` VARCHAR(191) NULL,
    `shiftId` VARCHAR(191) NULL,
    `shiftStartSnapshot` VARCHAR(191) NULL,
    `shiftEndSnapshot` VARCHAR(191) NULL,
    `lateMinutes` INTEGER NOT NULL DEFAULT 0,
    `standardOtMinutes` INTEGER NOT NULL DEFAULT 0,
    `weekendOtMinutes` INTEGER NOT NULL DEFAULT 0,
    `holidayOtMinutes` INTEGER NOT NULL DEFAULT 0,
    `nightOtMinutes` INTEGER NOT NULL DEFAULT 0,
    `specialEventOtMinutes` INTEGER NOT NULL DEFAULT 0,
    `otApprovedMinutes` INTEGER NOT NULL DEFAULT 0,
    `overtimePayAmount` DOUBLE NOT NULL DEFAULT 0.0,
    `otStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `projectId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `deploymentId` VARCHAR(191) NULL,
    `projectStatusFlag` VARCHAR(191) NULL,
    `officeLocationId` VARCHAR(191) NULL,
    `onCallAssignmentId` VARCHAR(191) NULL,
    `allowedPunchLocationId` VARCHAR(191) NULL,
    `punchLocationType` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Worksite` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `lat` DOUBLE NOT NULL,
    `lng` DOUBLE NOT NULL,
    `radiusMeters` DOUBLE NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Worksite_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceCorrection` (
    `id` VARCHAR(191) NOT NULL,
    `attendanceRecordId` VARCHAR(191) NOT NULL,
    `requestedCheckIn` DATETIME(3) NULL,
    `requestedCheckOut` DATETIME(3) NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shift` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `timeRange` VARCHAR(191) NOT NULL,
    `breakDuration` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Shift_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveType` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `accruable` BOOLEAN NOT NULL DEFAULT true,
    `carryForward` BOOLEAN NOT NULL DEFAULT true,
    `maxCarryOver` DOUBLE NOT NULL DEFAULT 0.0,
    `expiryMonths` INTEGER NOT NULL DEFAULT 12,
    `colorCode` VARCHAR(191) NOT NULL DEFAULT '#0058be',
    `sapExternalId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isPaid` BOOLEAN NOT NULL DEFAULT true,
    `requiresDocument` BOOLEAN NOT NULL DEFAULT false,
    `workflowCode` VARCHAR(191) NULL,
    `defaultAnnualAllocation` DOUBLE NULL,
    `maxDaysPerRequest` DOUBLE NULL,
    `allowHalfDay` BOOLEAN NOT NULL DEFAULT true,
    `allowCarryForward` BOOLEAN NOT NULL DEFAULT true,
    `carryForwardLimit` DOUBLE NULL,
    `genderRestriction` VARCHAR(191) NOT NULL DEFAULT 'ALL',
    `applicableAfterProbation` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `LeaveType_name_key`(`name`),
    UNIQUE INDEX `LeaveType_code_key`(`code`),
    UNIQUE INDEX `LeaveType_sapExternalId_key`(`sapExternalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveBalance` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `leaveTypeId` VARCHAR(191) NOT NULL,
    `allocatedDays` DOUBLE NOT NULL DEFAULT 0.0,
    `usedDays` DOUBLE NOT NULL DEFAULT 0.0,
    `pendingDays` DOUBLE NOT NULL DEFAULT 0.0,
    `carriedOver` DOUBLE NOT NULL DEFAULT 0.0,
    `sapExternalId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `year` INTEGER NOT NULL DEFAULT 2026,
    `carriedForwardDays` DOUBLE NOT NULL DEFAULT 0.0,
    `adjustmentDays` DOUBLE NOT NULL DEFAULT 0.0,
    `remarks` VARCHAR(191) NULL,

    UNIQUE INDEX `LeaveBalance_sapExternalId_key`(`sapExternalId`),
    UNIQUE INDEX `LeaveBalance_employeeId_leaveTypeId_year_key`(`employeeId`, `leaveTypeId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveBalanceLedger` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `leaveTypeId` VARCHAR(191) NOT NULL,
    `actionType` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `balanceBefore` DOUBLE NOT NULL,
    `balanceAfter` DOUBLE NOT NULL,
    `referenceId` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveRequest` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `employeeName` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `dateRange` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `totalDays` DOUBLE NULL,
    `leaveTypeId` VARCHAR(191) NULL,
    `currentStep` INTEGER NOT NULL DEFAULT 1,
    `totalSteps` INTEGER NOT NULL DEFAULT 1,
    `workflowId` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `firstActionAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvalDurationHours` DOUBLE NULL,
    `escalationCount` INTEGER NOT NULL DEFAULT 0,
    `relieverRequired` BOOLEAN NOT NULL DEFAULT false,
    `relieverAssignmentId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveApprovalWorkflow` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `conditionExpr` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveApprovalStep` (
    `id` VARCHAR(191) NOT NULL,
    `workflowId` VARCHAR(191) NOT NULL,
    `stepNumber` INTEGER NOT NULL,
    `roleRequired` VARCHAR(191) NOT NULL,
    `autoApprove` BOOLEAN NOT NULL DEFAULT false,
    `departmentFilter` VARCHAR(191) NULL,
    `gradeFilter` VARCHAR(191) NULL,
    `employeeGroupFilter` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LeaveApprovalStep_workflowId_stepNumber_key`(`workflowId`, `stepNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveApprovalHistory` (
    `id` VARCHAR(191) NOT NULL,
    `leaveRequestId` VARCHAR(191) NOT NULL,
    `approverId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `remarks` TEXT NULL,
    `previousStatus` VARCHAR(191) NOT NULL,
    `newStatus` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveApprovalDelegation` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `delegateApproverId` VARCHAR(191) NOT NULL,
    `validFrom` DATETIME(3) NOT NULL,
    `validTo` DATETIME(3) NOT NULL,
    `reason` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Holiday` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `isRecurring` BOOLEAN NOT NULL DEFAULT false,
    `scope` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Holiday_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SapMapping` (
    `id` VARCHAR(191) NOT NULL,
    `sourceField` VARCHAR(191) NOT NULL,
    `targetField` VARCHAR(191) NOT NULL,
    `transformationRule` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SyncLog` (
    `id` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `operation` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `details` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Announcement` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `author` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShiftTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `isSplit` BOOLEAN NOT NULL DEFAULT false,
    `splitStart` VARCHAR(191) NULL,
    `splitEnd` VARCHAR(191) NULL,
    `isFlexible` BOOLEAN NOT NULL DEFAULT false,
    `coreHours` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RotationTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `cycleDays` INTEGER NOT NULL,
    `patternJson` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShiftAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `shiftTemplateId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `officeLocationId` VARCHAR(191) NULL,
    `isSplitShift` BOOLEAN NOT NULL DEFAULT false,
    `parentAssignmentId` VARCHAR(191) NULL,
    `relieverRequired` BOOLEAN NOT NULL DEFAULT false,
    `relieverAssignmentId` VARCHAR(191) NULL,
    `assignmentStatus` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',

    INDEX `ShiftAssignment_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShiftSwapRequest` (
    `id` VARCHAR(191) NOT NULL,
    `requestorId` VARCHAR(191) NOT NULL,
    `targetEmployeeId` VARCHAR(191) NOT NULL,
    `requestorShiftId` VARCHAR(191) NOT NULL,
    `targetShiftId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `reviewNotes` VARCHAR(191) NULL,
    `approvedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OvertimeRate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `overtimeType` VARCHAR(191) NOT NULL,
    `multiplier` DOUBLE NOT NULL,
    `fixedRateAmount` DOUBLE NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'QAR',
    `appliesOnWeekend` BOOLEAN NOT NULL DEFAULT false,
    `appliesOnHoliday` BOOLEAN NOT NULL DEFAULT false,
    `appliesAfterMinutes` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SapConnection` (
    `id` VARCHAR(191) NOT NULL,
    `systemName` VARCHAR(191) NOT NULL,
    `odataUrl` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `privateKeyVaultId` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SapConnection_systemName_key`(`systemName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SapSyncJob` (
    `id` VARCHAR(191) NOT NULL,
    `connectionId` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `syncType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `recordsProcessed` INTEGER NOT NULL DEFAULT 0,
    `recordsSucceeded` INTEGER NOT NULL DEFAULT 0,
    `recordsFailed` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,
    `deltaToken` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SapSyncLog` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL,
    `entityName` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `message` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SapFieldMapping` (
    `id` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `sourceField` VARCHAR(191) NOT NULL,
    `targetField` VARCHAR(191) NOT NULL,
    `transformRule` VARCHAR(191) NULL,
    `validationRules` VARCHAR(191) NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SapRetryQueue` (
    `id` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `payload` TEXT NOT NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NOT NULL,
    `lastError` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SapExportQueue` (
    `id` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `recordId` VARCHAR(191) NOT NULL,
    `payload` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `sapAckId` VARCHAR(191) NULL,
    `sapAckStatus` VARCHAR(191) NULL,
    `sapAckTimestamp` DATETIME(3) NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SapExportQueue_idempotencyKey_key`(`idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SapPayrollStage` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `payrollPeriod` VARCHAR(191) NOT NULL,
    `wageType` VARCHAR(191) NOT NULL,
    `calculatedHours` DOUBLE NOT NULL,
    `calculatedPay` DOUBLE NOT NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `isExported` BOOLEAN NOT NULL DEFAULT false,
    `exportedJobId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SapPayrollStage_employeeId_payrollPeriod_wageType_key`(`employeeId`, `payrollPeriod`, `wageType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SapReconciliationLog` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `wfmHours` DOUBLE NOT NULL,
    `sapHours` DOUBLE NOT NULL,
    `discrepancy` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'MATCHED',
    `comments` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SapPayrollPeriodLock` (
    `id` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `lockedById` VARCHAR(191) NULL,
    `lockedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SapPayrollPeriodLock_period_key`(`period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecurityOperationsPeriodLock` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL DEFAULT 'SECURITY_GUARDING',
    `period` VARCHAR(191) NOT NULL,
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `lockedById` VARCHAR(191) NULL,
    `lockedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecurityOperationsPeriodLock_operationType_idx`(`operationType`),
    INDEX `SecurityOperationsPeriodLock_period_idx`(`period`),
    UNIQUE INDEX `SecurityOperationsPeriodLock_operationType_period_key`(`operationType`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SavedReport` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `reportType` VARCHAR(191) NOT NULL,
    `filtersJson` TEXT NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `isShared` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportExportLog` (
    `id` VARCHAR(191) NOT NULL,
    `reportType` VARCHAR(191) NOT NULL,
    `exportFormat` VARCHAR(191) NOT NULL,
    `filtersJson` TEXT NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `exportedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserActivityLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `beforeJson` TEXT NULL,
    `afterJson` TEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionCheckLog` (
    `id` VARCHAR(191) NOT NULL,
    `checkName` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `resultJson` TEXT NOT NULL,
    `checkedById` VARCHAR(191) NULL,
    `checkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BackupJob` (
    `id` VARCHAR(191) NOT NULL,
    `backupType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `checksum` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BackupAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `backupJobId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `performedById` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `details` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeBulkUploadJob` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `totalRows` INTEGER NOT NULL,
    `validRows` INTEGER NOT NULL,
    `invalidRows` INTEGER NOT NULL,
    `importedRows` INTEGER NOT NULL,
    `failedRows` INTEGER NOT NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `errorReportPath` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemRole` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isSystemDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isEditable` BOOLEAN NOT NULL DEFAULT true,
    `scope` VARCHAR(191) NULL DEFAULT 'Global',
    `roleType` VARCHAR(191) NOT NULL DEFAULT 'White Collar Operations',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SystemRole_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemPermission` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `pagePath` VARCHAR(191) NULL,
    `action` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SystemPermission_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `id` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `canView` BOOLEAN NOT NULL DEFAULT false,
    `canCreate` BOOLEAN NOT NULL DEFAULT false,
    `canEdit` BOOLEAN NOT NULL DEFAULT false,
    `canDelete` BOOLEAN NOT NULL DEFAULT false,
    `canApprove` BOOLEAN NOT NULL DEFAULT false,
    `canExport` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRoleAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `assignedById` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlueCollarPositionCategory` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BlueCollarPositionCategory_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `projectCode` VARCHAR(191) NOT NULL,
    `projectName` VARCHAR(191) NOT NULL,
    `projectType` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    `isOnCallProject` BOOLEAN NOT NULL DEFAULT false,
    `clientName` VARCHAR(191) NULL,
    `clientCode` VARCHAR(191) NULL,
    `contractNumber` VARCHAR(191) NULL,
    `costCenter` VARCHAR(191) NOT NULL,
    `sapProjectCode` VARCHAR(191) NULL,
    `sapCostCenterCode` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `locationId` VARCHAR(191) NULL,

    UNIQUE INDEX `Project_projectCode_key`(`projectCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectSite` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `siteCode` VARCHAR(191) NOT NULL,
    `siteName` VARCHAR(191) NOT NULL,
    `address` TEXT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `geofenceRadiusMeters` DOUBLE NOT NULL DEFAULT 150.0,
    `sapSiteCode` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `locationId` VARCHAR(191) NULL,

    UNIQUE INDEX `ProjectSite_siteCode_key`(`siteCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeDeployment` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `positionCategoryId` VARCHAR(191) NOT NULL,
    `deploymentDate` DATETIME(3) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `plannedHours` DOUBLE NOT NULL,
    `actualHours` DOUBLE NULL,
    `shiftAssignmentId` VARCHAR(191) NULL,
    `attendanceRecordId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PLANNED',
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Designation` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `employeeCategory` VARCHAR(191) NOT NULL DEFAULT 'BOTH',
    `isSupervisorPosition` BOOLEAN NOT NULL DEFAULT false,
    `isRelieverEligible` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Designation_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TradeClassification` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `linkedDesignationId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TradeClassification_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LocationMaster` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `locationCode` VARCHAR(191) NOT NULL,
    `locationName` VARCHAR(191) NOT NULL,
    `address` TEXT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `defaultGeofenceRadiusMeters` DOUBLE NOT NULL DEFAULT 150.0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LocationMaster_locationCode_key`(`locationCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostCenter` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `costCenterCode` VARCHAR(191) NOT NULL,
    `costCenterName` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sapCostCenterCode` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CostCenter_costCenterCode_key`(`costCenterCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShiftRelieverAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `originalEmployeeId` VARCHAR(191) NOT NULL,
    `relieverEmployeeId` VARCHAR(191) NOT NULL,
    `shiftAssignmentId` VARCHAR(191) NULL,
    `deploymentId` VARCHAR(191) NULL,
    `leaveRequestId` VARCHAR(191) NULL,
    `date` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PLANNED',
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RelieverStandbyRule` (
    `id` VARCHAR(191) NOT NULL,
    `ruleName` VARCHAR(191) NOT NULL,
    `designationId` VARCHAR(191) NULL,
    `tradeClassificationId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `standbyRequired` BOOLEAN NOT NULL DEFAULT false,
    `relieverRequiredForLeave` BOOLEAN NOT NULL DEFAULT false,
    `relieverRequiredForOff` BOOLEAN NOT NULL DEFAULT false,
    `relieverRequiredForVacation` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Company` (
    `id` VARCHAR(191) NOT NULL,
    `companyCode` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Company_companyCode_key`(`companyCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyAttendancePolicy` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `policyName` VARCHAR(191) NOT NULL,
    `isGeoFencingEnabled` BOOLEAN NOT NULL DEFAULT true,
    `defaultGeofenceRadiusMeters` DOUBLE NOT NULL DEFAULT 150.0,
    `requireSelfie` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AllowedPunchLocation` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `locationType` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `radiusMeters` DOUBLE NOT NULL DEFAULT 150.0,
    `address` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeAllowedPunchLocation` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `allowedPunchLocationId` VARCHAR(191) NOT NULL,
    `validFrom` DATETIME(3) NULL,
    `validTo` DATETIME(3) NULL,
    `priority` INTEGER NOT NULL DEFAULT 1,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OnCallAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `allowedPunchLocationId` VARCHAR(191) NULL,
    `assignmentDate` DATETIME(3) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'STANDBY',
    `description` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClearanceRequest` (
    `id` VARCHAR(191) NOT NULL,
    `clearanceNumber` VARCHAR(191) NOT NULL,
    `formCode` VARCHAR(191) NULL,
    `issueRef` VARCHAR(191) NULL,
    `issueDate` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `clearanceType` VARCHAR(191) NOT NULL,
    `separationType` VARCHAR(191) NULL,
    `linkedLeaveRequestId` VARCHAR(191) NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `requestDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dateOfJoiningSnapshot` VARCHAR(191) NULL,
    `employeeCodeSnapshot` VARCHAR(191) NULL,
    `employeeNameSnapshot` VARCHAR(191) NULL,
    `designationSnapshot` VARCHAR(191) NULL,
    `workingForSnapshot` VARCHAR(191) NULL,
    `qidNumberSnapshot` VARCHAR(191) NULL,
    `qidExpiryDateSnapshot` VARCHAR(191) NULL,
    `passportNumberSnapshot` VARCHAR(191) NULL,
    `passportExpiryDateSnapshot` VARCHAR(191) NULL,
    `departureDate` DATETIME(3) NULL,
    `returningDate` DATETIME(3) NULL,
    `lastWorkingDate` DATETIME(3) NULL,
    `expectedReturnDate` DATETIME(3) NULL,
    `typeOfProcess` VARCHAR(191) NULL,
    `employeeRemarks` TEXT NULL,
    `employeeSignedAt` DATETIME(3) NULL,
    `employeeSignatureName` VARCHAR(191) NULL,
    `employeeSignatureData` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `currentStepOrder` INTEGER NOT NULL DEFAULT 0,
    `finalApprovedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ClearanceRequest_clearanceNumber_key`(`clearanceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClearanceTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `clearanceType` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ClearanceTemplate_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClearanceTemplateSection` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `sectionName` VARCHAR(191) NOT NULL,
    `stepOrder` INTEGER NOT NULL,
    `defaultApproverId` VARCHAR(191) NULL,
    `defaultApproverRole` VARCHAR(191) NULL,
    `isExecutive` BOOLEAN NOT NULL DEFAULT false,
    `isRequiredByDefault` BOOLEAN NOT NULL DEFAULT true,
    `conditionalRule` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClearanceChecklistItem` (
    `id` VARCHAR(191) NOT NULL,
    `sectionId` VARCHAR(191) NOT NULL,
    `itemText` TEXT NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClearanceApprovalStep` (
    `id` VARCHAR(191) NOT NULL,
    `clearanceRequestId` VARCHAR(191) NOT NULL,
    `stepOrder` INTEGER NOT NULL,
    `sectionName` VARCHAR(191) NOT NULL,
    `isApplicable` BOOLEAN NOT NULL DEFAULT true,
    `notApplicableReason` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `assignedApproverId` VARCHAR(191) NULL,
    `fallbackRole` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `remarks` TEXT NULL,
    `signatureName` VARCHAR(191) NULL,
    `signatureDate` DATETIME(3) NULL,
    `actedAt` DATETIME(3) NULL,
    `actedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClearanceApprovalResponse` (
    `id` VARCHAR(191) NOT NULL,
    `stepId` VARCHAR(191) NOT NULL,
    `actionType` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClearanceHistory` (
    `id` VARCHAR(191) NOT NULL,
    `clearanceRequestId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `actionType` VARCHAR(191) NOT NULL,
    `details` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserOperationAccess` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `allowedWhiteCollar` BOOLEAN NOT NULL DEFAULT true,
    `allowedSecurityGuarding` BOOLEAN NOT NULL DEFAULT false,
    `allowedFacilityManagement` BOOLEAN NOT NULL DEFAULT false,
    `defaultLanding` VARCHAR(191) NULL,
    `allowedCompanyIds` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserOperationAccess_employeeId_key`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerClient` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `customerType` VARCHAR(191) NOT NULL DEFAULT 'COMPANY',
    `tradingName` VARCHAR(191) NULL,
    `businessType` VARCHAR(191) NULL,
    `addressLine1` VARCHAR(191) NULL,
    `addressLine2` VARCHAR(191) NULL,
    `zone` VARCHAR(191) NULL,
    `area` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `poBox` VARCHAR(191) NULL,
    `mapLocation` VARCHAR(191) NULL,
    `mainPhone` VARCHAR(191) NULL,
    `mainEmail` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `operationContactName` VARCHAR(191) NULL,
    `operationContactDesignation` VARCHAR(191) NULL,
    `operationContactMobile` VARCHAR(191) NULL,
    `operationContactEmail` VARCHAR(191) NULL,
    `operationContactAltPhone` VARCHAR(191) NULL,
    `financeContactName` VARCHAR(191) NULL,
    `financeContactDesignation` VARCHAR(191) NULL,
    `financeContactMobile` VARCHAR(191) NULL,
    `financeContactEmail` VARCHAR(191) NULL,
    `financeContactAltPhone` VARCHAR(191) NULL,
    `billingEmail` VARCHAR(191) NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `crNumber` VARCHAR(191) NULL,
    `crExpiryDate` DATETIME(3) NULL,
    `taxNumber` VARCHAR(191) NULL,
    `establishmentCardNumber` VARCHAR(191) NULL,
    `establishmentCardExpiryDate` DATETIME(3) NULL,
    `authorizedSignatoryName` VARCHAR(191) NULL,
    `authorizedSignatoryQid` VARCHAR(191) NULL,
    `qidNumber` VARCHAR(191) NULL,
    `qidExpiryDate` DATETIME(3) NULL,
    `passportNumber` VARCHAR(191) NULL,
    `passportExpiryDate` DATETIME(3) NULL,
    `nationality` VARCHAR(191) NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `internalSalesPersonId` VARCHAR(191) NULL,
    `internalSalesPersonName` VARCHAR(191) NULL,
    `internalSalesPersonMobile` VARCHAR(191) NULL,
    `internalSalesPersonEmail` VARCHAR(191) NULL,
    `legalRemarks` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `tradeLicenseNumber` VARCHAR(191) NULL,
    `tradeLicenseIssueDate` DATETIME(3) NULL,
    `tradeLicenseExpiryDate` DATETIME(3) NULL,
    `tradeLicenseAuthority` VARCHAR(191) NULL,

    UNIQUE INDEX `ManpowerClient_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerContract` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `contractNumber` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `defaultManpowerCount` INTEGER NOT NULL DEFAULT 0,
    `defaultRelieverCount` INTEGER NOT NULL DEFAULT 0,
    `shiftDefinitions` JSON NULL,
    `durationNumber` INTEGER NULL,
    `durationUnit` VARCHAR(191) NULL,
    `totalDurationDays` INTEGER NULL,
    `totalManpowerValue` DOUBLE NULL,
    `totalMaterialValue` DOUBLE NULL,
    `totalContractValue` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `paymentCycle` VARCHAR(191) NULL,
    `creditDays` INTEGER NULL,
    `invoiceSubmissionDay` VARCHAR(191) NULL,
    `paymentRemarks` VARCHAR(191) NULL,
    `terminationClause` VARCHAR(191) NULL,
    `noticePeriodDays` INTEGER NULL,
    `terminationPenalty` VARCHAR(191) NULL,
    `earlyTerminationAllowed` BOOLEAN NOT NULL DEFAULT false,
    `terminationRemarks` VARCHAR(191) NULL,
    `specialConditions` VARCHAR(191) NULL,
    `serviceLevelTerms` VARCHAR(191) NULL,
    `penaltyClause` VARCHAR(191) NULL,
    `escalationMatrix` VARCHAR(191) NULL,
    `otherContractConditions` VARCHAR(191) NULL,
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `submittedForApprovalAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `activatedAt` DATETIME(3) NULL,
    `activatedBy` VARCHAR(191) NULL,
    `rejectionRemarks` VARCHAR(191) NULL,
    `terminationRequestedAt` DATETIME(3) NULL,
    `terminationRequestedBy` VARCHAR(191) NULL,
    `terminationReason` VARCHAR(191) NULL,
    `terminatedAt` DATETIME(3) NULL,
    `terminatedBy` VARCHAR(191) NULL,
    `terminationStatus` VARCHAR(191) NULL,

    UNIQUE INDEX `ManpowerContract_contractNumber_key`(`contractNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerProject` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManpowerProject_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerSite` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `radiusMeters` DOUBLE NOT NULL DEFAULT 100,
    `operationType` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `gatePassRequired` BOOLEAN NOT NULL DEFAULT false,
    `gatePassValidationMode` VARCHAR(191) NOT NULL DEFAULT 'WARNING',
    `clientApprovalRequired` BOOLEAN NOT NULL DEFAULT false,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManpowerSite_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecuritySiteManpowerAllocation` (
    `id` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `deploymentType` VARCHAR(191) NOT NULL DEFAULT 'PERMANENT',
    `relieverPoolType` VARCHAR(191) NOT NULL DEFAULT 'DEDICATED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecuritySiteManpowerAllocation_siteId_idx`(`siteId`),
    INDEX `SecuritySiteManpowerAllocation_position_idx`(`position`),
    INDEX `SecuritySiteManpowerAllocation_deploymentType_idx`(`deploymentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecuritySiteAllowance` (
    `id` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `siteAllowanceEnabled` BOOLEAN NOT NULL DEFAULT false,
    `siteAllowanceAmount` DOUBLE NOT NULL DEFAULT 0,
    `siteAllowanceFrequency` VARCHAR(191) NOT NULL DEFAULT 'MONTHLY',
    `allowanceDescription` TEXT NULL,
    `appliesToAllPositions` BOOLEAN NOT NULL DEFAULT true,
    `position` VARCHAR(191) NULL,
    `effectiveFrom` DATETIME(3) NULL,
    `effectiveTo` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecuritySiteAllowance_siteId_idx`(`siteId`),
    INDEX `SecuritySiteAllowance_siteId_isActive_idx`(`siteId`, `isActive`),
    INDEX `SecuritySiteAllowance_position_idx`(`position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerLocationUnit` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `remarks` TEXT NULL,
    `guardTourRequired` BOOLEAN NOT NULL DEFAULT false,
    `checkpointRequired` BOOLEAN NOT NULL DEFAULT false,
    `checkpointCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManpowerLocationUnit_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerCategory` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isBlueCollar` BOOLEAN NOT NULL DEFAULT true,
    `isDeployableInRoster` BOOLEAN NOT NULL DEFAULT true,
    `canWorkOvertime` BOOLEAN NOT NULL DEFAULT true,
    `requiresMoiLicense` BOOLEAN NOT NULL DEFAULT false,
    `requiresGatePassCheck` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManpowerCategory_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerShiftRequirement` (
    `id` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `locationUnitId` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `shiftCode` VARCHAR(191) NOT NULL,
    `requiredCount` INTEGER NOT NULL,
    `requiredRelieverCount` INTEGER NOT NULL DEFAULT 0,
    `shiftStartTime` VARCHAR(191) NULL,
    `shiftEndTime` VARCHAR(191) NULL,
    `dutyHours` DOUBLE NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerDeployment` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `shiftRequirementId` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `approvedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerDeploymentAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `deploymentId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `isReliever` BOOLEAN NOT NULL DEFAULT false,
    `deploymentType` VARCHAR(191) NOT NULL DEFAULT 'PERMANENT',
    `isOvertime` BOOLEAN NOT NULL DEFAULT false,
    `overtimeReason` VARCHAR(191) NULL,
    `sourceType` VARCHAR(191) NOT NULL DEFAULT 'GENERAL_POOL',
    `permanentDeploymentId` VARCHAR(191) NULL,
    `validationWarnings` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerRelieverAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `originalAssignmentId` VARCHAR(191) NOT NULL,
    `relieverEmployeeId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'APPROVED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecurityLicense` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `licenseType` VARCHAR(191) NOT NULL DEFAULT 'MOI',
    `licenseNumber` VARCHAR(191) NOT NULL,
    `issueDate` DATETIME(3) NOT NULL,
    `expiryDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'VALID',
    `documentUrl` VARCHAR(191) NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecurityLicense_employeeId_key`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecurityGatePass` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `gatePassNumber` VARCHAR(191) NOT NULL,
    `issueDate` DATETIME(3) NOT NULL,
    `expiryDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'VALID',
    `documentUrl` VARCHAR(191) NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecurityGatePass_employeeId_siteId_key`(`employeeId`, `siteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecurityProjectRelieverPool` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `requiredRelieverCount` INTEGER NOT NULL DEFAULT 0,
    `categoryId` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecurityProjectRelieverPool_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecurityProjectManpowerAllocation` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `contractRequirementId` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecurityProjectManpowerAllocation_projectId_idx`(`projectId`),
    INDEX `SecurityProjectManpowerAllocation_contractRequirementId_idx`(`contractRequirementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecurityProjectRelieverAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `relieverPoolId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecurityProjectCoordinatorAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `coordinatorEmployeeId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecurityProjectCoordinatorAssignment_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecuritySiteInspection` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `coordinatorEmployeeId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `inspectionDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `remarks` TEXT NULL,
    `followUpRequired` BOOLEAN NOT NULL DEFAULT false,
    `followUpStatus` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecuritySiteInspection_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerContractMaterial` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `materialId` VARCHAR(191) NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DOUBLE NULL,
    `isFoc` BOOLEAN NOT NULL DEFAULT false,
    `lineTotal` DOUBLE NULL,
    `remarks` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerProjectMaterialAllocation` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `materialId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManpowerProjectMaterialAllocation_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractManpowerRequirement` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `deploymentType` VARCHAR(191) NOT NULL,
    `unitPrice` DOUBLE NULL,
    `billingFrequency` VARCHAR(191) NULL,
    `billingPeriodCount` INTEGER NULL,
    `isFoc` BOOLEAN NOT NULL DEFAULT false,
    `lineTotal` DOUBLE NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractRelieverRequirement` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `sourcePreference` VARCHAR(191) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractShiftRequirement` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `shiftName` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `postsCovered` INTEGER NOT NULL,
    `daysPattern` VARCHAR(191) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerClientDocument` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NULL,
    `fileUrl` VARCHAR(191) NULL,
    `storagePath` VARCHAR(191) NULL,
    `expiryDate` DATETIME(3) NULL,
    `remarks` VARCHAR(191) NULL,
    `uploadedBy` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerContractAddendum` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `addendumNumber` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `addendumDate` DATETIME(3) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `addendumType` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `commercialImpact` VARCHAR(191) NULL,
    `calculatedCommercialImpact` DOUBLE NULL,
    `attachmentUrl` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerMaterialMaster` (
    `id` VARCHAR(191) NOT NULL,
    `materialCode` VARCHAR(191) NOT NULL,
    `materialName` VARCHAR(191) NOT NULL,
    `materialCategory` VARCHAR(191) NOT NULL,
    `unitOfMeasure` VARCHAR(191) NOT NULL,
    `defaultUnitPrice` DOUBLE NULL,
    `operationType` VARCHAR(191) NOT NULL DEFAULT 'SHARED',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManpowerMaterialMaster_materialCode_key`(`materialCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ManpowerContractAddendumLineItem` (
    `id` VARCHAR(191) NOT NULL,
    `addendumId` VARCHAR(191) NOT NULL,
    `itemType` VARCHAR(191) NOT NULL,
    `changeType` VARCHAR(191) NOT NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `unitPrice` DOUBLE NULL,
    `billingFrequency` VARCHAR(191) NULL,
    `isFoc` BOOLEAN NOT NULL DEFAULT false,
    `lineTotal` DOUBLE NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractApprovalWorkflow` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `workflowName` VARCHAR(191) NULL,
    `appliesTo` VARCHAR(191) NOT NULL DEFAULT 'ACTIVATION',
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `submittedAt` DATETIME(3) NULL,
    `submittedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `finalRemarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractApprovalLevel` (
    `id` VARCHAR(191) NOT NULL,
    `workflowId` VARCHAR(191) NOT NULL,
    `levelNumber` INTEGER NOT NULL,
    `levelName` VARCHAR(191) NOT NULL,
    `approvalRule` VARCHAR(191) NOT NULL DEFAULT 'ANY_ONE',
    `isMandatory` BOOLEAN NOT NULL DEFAULT true,
    `escalationDays` INTEGER NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractApprovalApprover` (
    `id` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NULL,
    `employeeName` VARCHAR(191) NULL,
    `employeeCode` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `roleName` VARCHAR(191) NULL,
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `approvedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `workflowName` VARCHAR(191) NOT NULL,
    `moduleType` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NULL,
    `appliesTo` VARCHAR(191) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowTemplateLevel` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `levelNumber` INTEGER NOT NULL,
    `levelName` VARCHAR(191) NOT NULL,
    `approvalRule` VARCHAR(191) NOT NULL DEFAULT 'ANY_ONE',
    `isMandatory` BOOLEAN NOT NULL DEFAULT true,
    `escalationDays` INTEGER NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowTemplateApprover` (
    `id` VARCHAR(191) NOT NULL,
    `levelId` VARCHAR(191) NOT NULL,
    `approverType` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NULL,
    `employeeName` VARCHAR(191) NULL,
    `employeeCode` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `roleName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowDelegation` (
    `id` VARCHAR(191) NOT NULL,
    `moduleType` VARCHAR(191) NULL,
    `operationType` VARCHAR(191) NULL,
    `originalApproverEmployeeId` VARCHAR(191) NOT NULL,
    `originalApproverName` VARCHAR(191) NULL,
    `delegatedApproverEmployeeId` VARCHAR(191) NOT NULL,
    `delegatedApproverName` VARCHAR(191) NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecurityOperationalEmployee` (
    `id` VARCHAR(191) NOT NULL,
    `sourceEmployeeId` VARCHAR(191) NOT NULL,
    `employeeCode` VARCHAR(191) NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `companyCode` VARCHAR(191) NULL,
    `employeeCategory` VARCHAR(191) NOT NULL DEFAULT 'BLUE_COLLAR',
    `operationType` VARCHAR(191) NOT NULL DEFAULT 'SECURITY_GUARDING',
    `designation` VARCHAR(191) NULL,
    `position` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `defaultLocation` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `employmentStatus` VARCHAR(191) NULL,
    `syncStatus` VARCHAR(191) NOT NULL DEFAULT 'SYNCED',
    `lastSyncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecurityOperationalEmployee_sourceEmployeeId_key`(`sourceEmployeeId`),
    INDEX `SecurityOperationalEmployee_companyCode_idx`(`companyCode`),
    INDEX `SecurityOperationalEmployee_operationType_idx`(`operationType`),
    INDEX `SecurityOperationalEmployee_employeeCategory_idx`(`employeeCategory`),
    INDEX `SecurityOperationalEmployee_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacCheckpoint` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `locationUnitId` VARCHAR(191) NULL,
    `checkpointName` VARCHAR(191) NOT NULL,
    `checkpointCode` VARCHAR(191) NULL,
    `nfcTagId` VARCHAR(191) NULL,
    `qrCode` VARCHAR(191) NULL,
    `checkpointType` VARCHAR(191) NOT NULL DEFAULT 'SECURITY_PATROL',
    `description` TEXT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `radiusMeters` INTEGER NULL,
    `scanRequired` BOOLEAN NOT NULL DEFAULT true,
    `photoRequired` BOOLEAN NOT NULL DEFAULT false,
    `checklistRequired` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecfacCheckpoint_nfcTagId_key`(`nfcTagId`),
    UNIQUE INDEX `SecfacCheckpoint_qrCode_key`(`qrCode`),
    INDEX `SecfacCheckpoint_operationType_idx`(`operationType`),
    INDEX `SecfacCheckpoint_siteId_idx`(`siteId`),
    INDEX `SecfacCheckpoint_locationUnitId_idx`(`locationUnitId`),
    INDEX `SecfacCheckpoint_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacChecklistTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `locationUnitId` VARCHAR(191) NULL,
    `checkpointId` VARCHAR(191) NULL,
    `templateName` VARCHAR(191) NOT NULL,
    `templateCode` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'GENERAL',
    `description` TEXT NULL,
    `checklistType` VARCHAR(191) NOT NULL DEFAULT 'STANDARD',
    `version` INTEGER NOT NULL DEFAULT 1,
    `requiresNfcScan` BOOLEAN NOT NULL DEFAULT false,
    `requiresPhoto` BOOLEAN NOT NULL DEFAULT false,
    `requiresGeoFence` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecfacChecklistTemplate_operationType_idx`(`operationType`),
    INDEX `SecfacChecklistTemplate_clientId_idx`(`clientId`),
    INDEX `SecfacChecklistTemplate_projectId_idx`(`projectId`),
    INDEX `SecfacChecklistTemplate_siteId_idx`(`siteId`),
    INDEX `SecfacChecklistTemplate_locationUnitId_idx`(`locationUnitId`),
    INDEX `SecfacChecklistTemplate_checkpointId_idx`(`checkpointId`),
    INDEX `SecfacChecklistTemplate_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacChecklistItem` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `itemText` VARCHAR(191) NOT NULL,
    `itemCode` VARCHAR(191) NULL,
    `itemType` VARCHAR(191) NOT NULL DEFAULT 'YES_NO',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `requiresPhoto` BOOLEAN NOT NULL DEFAULT false,
    `requiresComment` BOOLEAN NOT NULL DEFAULT false,
    `expectedValue` VARCHAR(191) NULL,
    `helpText` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecfacChecklistItem_templateId_idx`(`templateId`),
    INDEX `SecfacChecklistItem_itemType_idx`(`itemType`),
    INDEX `SecfacChecklistItem_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `locationUnitId` VARCHAR(191) NULL,
    `checkpointId` VARCHAR(191) NULL,
    `templateId` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `supervisorId` VARCHAR(191) NULL,
    `assignmentName` VARCHAR(191) NOT NULL,
    `assignmentCode` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `scheduledStart` DATETIME(3) NOT NULL,
    `scheduledEnd` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `patrolRouteId` VARCHAR(191) NULL,

    INDEX `SecfacAssignment_operationType_idx`(`operationType`),
    INDEX `SecfacAssignment_patrolRouteId_idx`(`patrolRouteId`),
    INDEX `SecfacAssignment_employeeId_idx`(`employeeId`),
    INDEX `SecfacAssignment_supervisorId_idx`(`supervisorId`),
    INDEX `SecfacAssignment_siteId_idx`(`siteId`),
    INDEX `SecfacAssignment_locationUnitId_idx`(`locationUnitId`),
    INDEX `SecfacAssignment_checkpointId_idx`(`checkpointId`),
    INDEX `SecfacAssignment_templateId_idx`(`templateId`),
    INDEX `SecfacAssignment_status_idx`(`status`),
    INDEX `SecfacAssignment_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacChecklistExecution` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `assignmentId` VARCHAR(191) NOT NULL,
    `checklistTemplateId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `checkpointId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `startedAt` DATETIME(3) NULL,
    `submittedAt` DATETIME(3) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `gpsAccuracyMeters` DOUBLE NULL,
    `deviceInfo` VARCHAR(191) NULL,
    `remarks` TEXT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewRemarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecfacChecklistExecution_operationType_idx`(`operationType`),
    INDEX `SecfacChecklistExecution_assignmentId_idx`(`assignmentId`),
    INDEX `SecfacChecklistExecution_checklistTemplateId_idx`(`checklistTemplateId`),
    INDEX `SecfacChecklistExecution_employeeId_idx`(`employeeId`),
    INDEX `SecfacChecklistExecution_siteId_idx`(`siteId`),
    INDEX `SecfacChecklistExecution_checkpointId_idx`(`checkpointId`),
    INDEX `SecfacChecklistExecution_status_idx`(`status`),
    INDEX `SecfacChecklistExecution_reviewedById_idx`(`reviewedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacChecklistResponse` (
    `id` VARCHAR(191) NOT NULL,
    `executionId` VARCHAR(191) NOT NULL,
    `checklistItemId` VARCHAR(191) NOT NULL,
    `itemTextSnapshot` VARCHAR(191) NOT NULL,
    `itemTypeSnapshot` VARCHAR(191) NOT NULL,
    `answerValue` VARCHAR(191) NULL,
    `answerText` TEXT NULL,
    `comment` TEXT NULL,
    `isFlagged` BOOLEAN NOT NULL DEFAULT false,
    `flagReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecfacChecklistResponse_executionId_idx`(`executionId`),
    INDEX `SecfacChecklistResponse_checklistItemId_idx`(`checklistItemId`),
    INDEX `SecfacChecklistResponse_isFlagged_idx`(`isFlagged`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacChecklistExecutionHistory` (
    `id` VARCHAR(191) NOT NULL,
    `executionId` VARCHAR(191) NOT NULL,
    `fromStatus` VARCHAR(191) NULL,
    `toStatus` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `remarks` TEXT NULL,
    `changedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SecfacChecklistExecutionHistory_executionId_idx`(`executionId`),
    INDEX `SecfacChecklistExecutionHistory_toStatus_idx`(`toStatus`),
    INDEX `SecfacChecklistExecutionHistory_changedById_idx`(`changedById`),
    INDEX `SecfacChecklistExecutionHistory_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacEvidenceAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `executionId` VARCHAR(191) NOT NULL,
    `responseId` VARCHAR(191) NULL,
    `assignmentId` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `checkpointId` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `fileSizeBytes` INTEGER NOT NULL,
    `storagePath` VARCHAR(191) NOT NULL,
    `evidenceType` VARCHAR(191) NOT NULL DEFAULT 'PHOTO',
    `caption` VARCHAR(191) NULL,
    `capturedAt` DATETIME(3) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `gpsAccuracyMeters` DOUBLE NULL,
    `uploadedById` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecfacEvidenceAttachment_operationType_idx`(`operationType`),
    INDEX `SecfacEvidenceAttachment_executionId_idx`(`executionId`),
    INDEX `SecfacEvidenceAttachment_responseId_idx`(`responseId`),
    INDEX `SecfacEvidenceAttachment_assignmentId_idx`(`assignmentId`),
    INDEX `SecfacEvidenceAttachment_employeeId_idx`(`employeeId`),
    INDEX `SecfacEvidenceAttachment_siteId_idx`(`siteId`),
    INDEX `SecfacEvidenceAttachment_checkpointId_idx`(`checkpointId`),
    INDEX `SecfacEvidenceAttachment_evidenceType_idx`(`evidenceType`),
    INDEX `SecfacEvidenceAttachment_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacScanProof` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `assignmentId` VARCHAR(191) NOT NULL,
    `executionId` VARCHAR(191) NULL,
    `checkpointId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `scanMode` VARCHAR(191) NOT NULL,
    `scannedValue` VARCHAR(191) NULL,
    `expectedValue` VARCHAR(191) NULL,
    `validationStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `failureReason` VARCHAR(191) NULL,
    `exceptionReason` TEXT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `gpsAccuracyMeters` DOUBLE NULL,
    `deviceInfo` VARCHAR(191) NULL,
    `scannedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewRemarks` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecfacScanProof_operationType_idx`(`operationType`),
    INDEX `SecfacScanProof_assignmentId_idx`(`assignmentId`),
    INDEX `SecfacScanProof_executionId_idx`(`executionId`),
    INDEX `SecfacScanProof_checkpointId_idx`(`checkpointId`),
    INDEX `SecfacScanProof_employeeId_idx`(`employeeId`),
    INDEX `SecfacScanProof_siteId_idx`(`siteId`),
    INDEX `SecfacScanProof_scanMode_idx`(`scanMode`),
    INDEX `SecfacScanProof_validationStatus_idx`(`validationStatus`),
    INDEX `SecfacScanProof_scannedAt_idx`(`scannedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacPatrolRoute` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `routeName` VARCHAR(191) NOT NULL,
    `routeCode` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecfacPatrolRoute_operationType_idx`(`operationType`),
    INDEX `SecfacPatrolRoute_siteId_idx`(`siteId`),
    INDEX `SecfacPatrolRoute_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacPatrolRouteCheckpoint` (
    `id` VARCHAR(191) NOT NULL,
    `routeId` VARCHAR(191) NOT NULL,
    `checkpointId` VARCHAR(191) NOT NULL,
    `sequenceNo` INTEGER NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecfacPatrolRouteCheckpoint_routeId_idx`(`routeId`),
    INDEX `SecfacPatrolRouteCheckpoint_checkpointId_idx`(`checkpointId`),
    UNIQUE INDEX `SecfacPatrolRouteCheckpoint_routeId_sequenceNo_key`(`routeId`, `sequenceNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacPatrolExecution` (
    `id` VARCHAR(191) NOT NULL,
    `routeId` VARCHAR(191) NOT NULL,
    `assignmentId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'NOT_STARTED',
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecfacPatrolExecution_routeId_idx`(`routeId`),
    INDEX `SecfacPatrolExecution_assignmentId_idx`(`assignmentId`),
    INDEX `SecfacPatrolExecution_employeeId_idx`(`employeeId`),
    INDEX `SecfacPatrolExecution_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacPatrolExecutionCheckpoint` (
    `id` VARCHAR(191) NOT NULL,
    `executionId` VARCHAR(191) NOT NULL,
    `checkpointId` VARCHAR(191) NOT NULL,
    `sequenceNo` INTEGER NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `scanProofId` VARCHAR(191) NULL,
    `validatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecfacPatrolExecutionCheckpoint_scanProofId_key`(`scanProofId`),
    INDEX `SecfacPatrolExecutionCheckpoint_executionId_idx`(`executionId`),
    INDEX `SecfacPatrolExecutionCheckpoint_checkpointId_idx`(`checkpointId`),
    INDEX `SecfacPatrolExecutionCheckpoint_status_idx`(`status`),
    UNIQUE INDEX `SecfacPatrolExecutionCheckpoint_executionId_sequenceNo_key`(`executionId`, `sequenceNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacSyncConflict` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `employeeCode` VARCHAR(191) NULL,
    `employeeName` VARCHAR(191) NULL,
    `assignmentId` VARCHAR(191) NULL,
    `checklistExecutionId` VARCHAR(191) NULL,
    `patrolExecutionId` VARCHAR(191) NULL,
    `checkpointExecutionId` VARCHAR(191) NULL,
    `actionType` VARCHAR(191) NOT NULL,
    `queueItemId` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `conflictType` VARCHAR(191) NOT NULL,
    `serverMessage` TEXT NOT NULL,
    `recommendedAction` VARCHAR(191) NULL,
    `canRetry` BOOLEAN NOT NULL DEFAULT false,
    `canDiscard` BOOLEAN NOT NULL DEFAULT true,
    `needsSupervisorReview` BOOLEAN NOT NULL DEFAULT true,
    `lastAttemptAt` DATETIME(3) NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `acknowledgedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecfacSyncConflict_operationType_idx`(`operationType`),
    INDEX `SecfacSyncConflict_employeeId_idx`(`employeeId`),
    INDEX `SecfacSyncConflict_assignmentId_idx`(`assignmentId`),
    INDEX `SecfacSyncConflict_checklistExecutionId_idx`(`checklistExecutionId`),
    INDEX `SecfacSyncConflict_patrolExecutionId_idx`(`patrolExecutionId`),
    INDEX `SecfacSyncConflict_status_idx`(`status`),
    INDEX `SecfacSyncConflict_conflictType_idx`(`conflictType`),
    INDEX `SecfacSyncConflict_queueItemId_idx`(`queueItemId`),
    UNIQUE INDEX `SecfacSyncConflict_queueItemId_actionType_idempotencyKey_key`(`queueItemId`, `actionType`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacFieldExecutionAudit` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `employeeCode` VARCHAR(191) NULL,
    `employeeName` VARCHAR(191) NULL,
    `actorUserId` VARCHAR(191) NULL,
    `actorEmployeeId` VARCHAR(191) NULL,
    `actorName` VARCHAR(191) NULL,
    `actorEmail` VARCHAR(191) NULL,
    `actorRole` VARCHAR(191) NULL,
    `assignmentId` VARCHAR(191) NULL,
    `checklistExecutionId` VARCHAR(191) NULL,
    `patrolExecutionId` VARCHAR(191) NULL,
    `checkpointExecutionId` VARCHAR(191) NULL,
    `scanProofId` VARCHAR(191) NULL,
    `evidenceAttachmentId` VARCHAR(191) NULL,
    `syncConflictId` VARCHAR(191) NULL,
    `actionType` VARCHAR(191) NOT NULL,
    `actionSource` VARCHAR(191) NOT NULL,
    `queueItemId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `deviceSessionId` VARCHAR(191) NULL,
    `deviceLabel` VARCHAR(191) NULL,
    `devicePlatform` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `appSource` VARCHAR(191) NULL,
    `clientActionAt` DATETIME(3) NULL,
    `serverReceivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `syncMode` VARCHAR(191) NOT NULL DEFAULT 'ONLINE',
    `networkStatus` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `accuracy` DOUBLE NULL,
    `resultStatus` VARCHAR(191) NOT NULL DEFAULT 'SUCCESS',
    `resultMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecfacFieldExecutionAudit_operationType_idx`(`operationType`),
    INDEX `SecfacFieldExecutionAudit_employeeId_idx`(`employeeId`),
    INDEX `SecfacFieldExecutionAudit_actorUserId_idx`(`actorUserId`),
    INDEX `SecfacFieldExecutionAudit_assignmentId_idx`(`assignmentId`),
    INDEX `SecfacFieldExecutionAudit_checklistExecutionId_idx`(`checklistExecutionId`),
    INDEX `SecfacFieldExecutionAudit_patrolExecutionId_idx`(`patrolExecutionId`),
    INDEX `SecfacFieldExecutionAudit_syncConflictId_idx`(`syncConflictId`),
    INDEX `SecfacFieldExecutionAudit_actionType_idx`(`actionType`),
    INDEX `SecfacFieldExecutionAudit_actionSource_idx`(`actionSource`),
    INDEX `SecfacFieldExecutionAudit_resultStatus_idx`(`resultStatus`),
    INDEX `SecfacFieldExecutionAudit_syncMode_idx`(`syncMode`),
    INDEX `SecfacFieldExecutionAudit_createdAt_idx`(`createdAt`),
    INDEX `SecfacFieldExecutionAudit_deviceSessionId_idx`(`deviceSessionId`),
    INDEX `SecfacFieldExecutionAudit_idempotencyKey_idx`(`idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_positionCategoryId_fkey` FOREIGN KEY (`positionCategoryId`) REFERENCES `BlueCollarPositionCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_defaultProjectId_fkey` FOREIGN KEY (`defaultProjectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_defaultSiteId_fkey` FOREIGN KEY (`defaultSiteId`) REFERENCES `ProjectSite`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_designationId_fkey` FOREIGN KEY (`designationId`) REFERENCES `Designation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_tradeClassificationId_fkey` FOREIGN KEY (`tradeClassificationId`) REFERENCES `TradeClassification`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `CostCenter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_defaultLocationId_fkey` FOREIGN KEY (`defaultLocationId`) REFERENCES `LocationMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_officeLocationId_fkey` FOREIGN KEY (`officeLocationId`) REFERENCES `LocationMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_defaultPunchLocationId_fkey` FOREIGN KEY (`defaultPunchLocationId`) REFERENCES `AllowedPunchLocation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_immediateSupervisorId_fkey` FOREIGN KEY (`immediateSupervisorId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_manpowerCategoryId_fkey` FOREIGN KEY (`manpowerCategoryId`) REFERENCES `ManpowerCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Department` ADD CONSTRAINT `Department_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_worksiteId_fkey` FOREIGN KEY (`worksiteId`) REFERENCES `Worksite`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_onCallAssignmentId_fkey` FOREIGN KEY (`onCallAssignmentId`) REFERENCES `OnCallAssignment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_allowedPunchLocationId_fkey` FOREIGN KEY (`allowedPunchLocationId`) REFERENCES `AllowedPunchLocation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceCorrection` ADD CONSTRAINT `AttendanceCorrection_attendanceRecordId_fkey` FOREIGN KEY (`attendanceRecordId`) REFERENCES `AttendanceRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveBalance` ADD CONSTRAINT `LeaveBalance_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveBalance` ADD CONSTRAINT `LeaveBalance_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `LeaveType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveBalanceLedger` ADD CONSTRAINT `LeaveBalanceLedger_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveBalanceLedger` ADD CONSTRAINT `LeaveBalanceLedger_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `LeaveType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `LeaveType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveApprovalStep` ADD CONSTRAINT `LeaveApprovalStep_workflowId_fkey` FOREIGN KEY (`workflowId`) REFERENCES `LeaveApprovalWorkflow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveApprovalHistory` ADD CONSTRAINT `LeaveApprovalHistory_leaveRequestId_fkey` FOREIGN KEY (`leaveRequestId`) REFERENCES `LeaveRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftAssignment` ADD CONSTRAINT `ShiftAssignment_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftAssignment` ADD CONSTRAINT `ShiftAssignment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftAssignment` ADD CONSTRAINT `ShiftAssignment_shiftTemplateId_fkey` FOREIGN KEY (`shiftTemplateId`) REFERENCES `ShiftTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SapSyncJob` ADD CONSTRAINT `SapSyncJob_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `SapConnection`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SapSyncLog` ADD CONSTRAINT `SapSyncLog_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `SapSyncJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `LocationMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectSite` ADD CONSTRAINT `ProjectSite_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectSite` ADD CONSTRAINT `ProjectSite_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectSite` ADD CONSTRAINT `ProjectSite_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `LocationMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeDeployment` ADD CONSTRAINT `EmployeeDeployment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeDeployment` ADD CONSTRAINT `EmployeeDeployment_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeDeployment` ADD CONSTRAINT `EmployeeDeployment_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ProjectSite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeDeployment` ADD CONSTRAINT `EmployeeDeployment_positionCategoryId_fkey` FOREIGN KEY (`positionCategoryId`) REFERENCES `BlueCollarPositionCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LocationMaster` ADD CONSTRAINT `LocationMaster_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CostCenter` ADD CONSTRAINT `CostCenter_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyAttendancePolicy` ADD CONSTRAINT `CompanyAttendancePolicy_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AllowedPunchLocation` ADD CONSTRAINT `AllowedPunchLocation_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeAllowedPunchLocation` ADD CONSTRAINT `EmployeeAllowedPunchLocation_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeAllowedPunchLocation` ADD CONSTRAINT `EmployeeAllowedPunchLocation_allowedPunchLocationId_fkey` FOREIGN KEY (`allowedPunchLocationId`) REFERENCES `AllowedPunchLocation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnCallAssignment` ADD CONSTRAINT `OnCallAssignment_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnCallAssignment` ADD CONSTRAINT `OnCallAssignment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnCallAssignment` ADD CONSTRAINT `OnCallAssignment_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnCallAssignment` ADD CONSTRAINT `OnCallAssignment_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ProjectSite`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnCallAssignment` ADD CONSTRAINT `OnCallAssignment_allowedPunchLocationId_fkey` FOREIGN KEY (`allowedPunchLocationId`) REFERENCES `AllowedPunchLocation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClearanceRequest` ADD CONSTRAINT `ClearanceRequest_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClearanceRequest` ADD CONSTRAINT `ClearanceRequest_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClearanceTemplateSection` ADD CONSTRAINT `ClearanceTemplateSection_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ClearanceTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClearanceChecklistItem` ADD CONSTRAINT `ClearanceChecklistItem_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `ClearanceTemplateSection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClearanceApprovalStep` ADD CONSTRAINT `ClearanceApprovalStep_clearanceRequestId_fkey` FOREIGN KEY (`clearanceRequestId`) REFERENCES `ClearanceRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClearanceApprovalStep` ADD CONSTRAINT `ClearanceApprovalStep_assignedApproverId_fkey` FOREIGN KEY (`assignedApproverId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClearanceApprovalResponse` ADD CONSTRAINT `ClearanceApprovalResponse_stepId_fkey` FOREIGN KEY (`stepId`) REFERENCES `ClearanceApprovalStep`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClearanceHistory` ADD CONSTRAINT `ClearanceHistory_clearanceRequestId_fkey` FOREIGN KEY (`clearanceRequestId`) REFERENCES `ClearanceRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserOperationAccess` ADD CONSTRAINT `UserOperationAccess_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerContract` ADD CONSTRAINT `ManpowerContract_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `ManpowerClient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerProject` ADD CONSTRAINT `ManpowerProject_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerSite` ADD CONSTRAINT `ManpowerSite_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ManpowerProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecuritySiteManpowerAllocation` ADD CONSTRAINT `SecuritySiteManpowerAllocation_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecuritySiteAllowance` ADD CONSTRAINT `SecuritySiteAllowance_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerLocationUnit` ADD CONSTRAINT `ManpowerLocationUnit_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerShiftRequirement` ADD CONSTRAINT `ManpowerShiftRequirement_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerShiftRequirement` ADD CONSTRAINT `ManpowerShiftRequirement_locationUnitId_fkey` FOREIGN KEY (`locationUnitId`) REFERENCES `ManpowerLocationUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerShiftRequirement` ADD CONSTRAINT `ManpowerShiftRequirement_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ManpowerCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerDeployment` ADD CONSTRAINT `ManpowerDeployment_shiftRequirementId_fkey` FOREIGN KEY (`shiftRequirementId`) REFERENCES `ManpowerShiftRequirement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerDeploymentAssignment` ADD CONSTRAINT `ManpowerDeploymentAssignment_deploymentId_fkey` FOREIGN KEY (`deploymentId`) REFERENCES `ManpowerDeployment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerDeploymentAssignment` ADD CONSTRAINT `ManpowerDeploymentAssignment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerRelieverAssignment` ADD CONSTRAINT `ManpowerRelieverAssignment_originalAssignmentId_fkey` FOREIGN KEY (`originalAssignmentId`) REFERENCES `ManpowerDeploymentAssignment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerRelieverAssignment` ADD CONSTRAINT `ManpowerRelieverAssignment_relieverEmployeeId_fkey` FOREIGN KEY (`relieverEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecurityLicense` ADD CONSTRAINT `SecurityLicense_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecurityGatePass` ADD CONSTRAINT `SecurityGatePass_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecurityGatePass` ADD CONSTRAINT `SecurityGatePass_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ManpowerProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecurityGatePass` ADD CONSTRAINT `SecurityGatePass_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecurityProjectRelieverPool` ADD CONSTRAINT `SecurityProjectRelieverPool_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ManpowerProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecurityProjectRelieverPool` ADD CONSTRAINT `SecurityProjectRelieverPool_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecurityProjectRelieverPool` ADD CONSTRAINT `SecurityProjectRelieverPool_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ManpowerCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecurityProjectManpowerAllocation` ADD CONSTRAINT `SecurityProjectManpowerAllocation_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ManpowerProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecurityProjectRelieverAssignment` ADD CONSTRAINT `SecurityProjectRelieverAssignment_relieverPoolId_fkey` FOREIGN KEY (`relieverPoolId`) REFERENCES `SecurityProjectRelieverPool`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecurityProjectRelieverAssignment` ADD CONSTRAINT `SecurityProjectRelieverAssignment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecurityProjectCoordinatorAssignment` ADD CONSTRAINT `SecurityProjectCoordinatorAssignment_coordinatorEmployeeId_fkey` FOREIGN KEY (`coordinatorEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecurityProjectCoordinatorAssignment` ADD CONSTRAINT `SecurityProjectCoordinatorAssignment_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ManpowerProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecurityProjectCoordinatorAssignment` ADD CONSTRAINT `SecurityProjectCoordinatorAssignment_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecuritySiteInspection` ADD CONSTRAINT `SecuritySiteInspection_coordinatorEmployeeId_fkey` FOREIGN KEY (`coordinatorEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecuritySiteInspection` ADD CONSTRAINT `SecuritySiteInspection_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ManpowerProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecuritySiteInspection` ADD CONSTRAINT `SecuritySiteInspection_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerContractMaterial` ADD CONSTRAINT `ManpowerContractMaterial_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerContractMaterial` ADD CONSTRAINT `ManpowerContractMaterial_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `ManpowerMaterialMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerProjectMaterialAllocation` ADD CONSTRAINT `ManpowerProjectMaterialAllocation_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `ManpowerContractMaterial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerProjectMaterialAllocation` ADD CONSTRAINT `ManpowerProjectMaterialAllocation_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ManpowerProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractManpowerRequirement` ADD CONSTRAINT `ContractManpowerRequirement_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractRelieverRequirement` ADD CONSTRAINT `ContractRelieverRequirement_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractShiftRequirement` ADD CONSTRAINT `ContractShiftRequirement_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerClientDocument` ADD CONSTRAINT `ManpowerClientDocument_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `ManpowerClient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerClientDocument` ADD CONSTRAINT `ManpowerClientDocument_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerContractAddendum` ADD CONSTRAINT `ManpowerContractAddendum_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerContractAddendumLineItem` ADD CONSTRAINT `ManpowerContractAddendumLineItem_addendumId_fkey` FOREIGN KEY (`addendumId`) REFERENCES `ManpowerContractAddendum`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractApprovalWorkflow` ADD CONSTRAINT `ContractApprovalWorkflow_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractApprovalLevel` ADD CONSTRAINT `ContractApprovalLevel_workflowId_fkey` FOREIGN KEY (`workflowId`) REFERENCES `ContractApprovalWorkflow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractApprovalApprover` ADD CONSTRAINT `ContractApprovalApprover_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `ContractApprovalLevel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowTemplateLevel` ADD CONSTRAINT `WorkflowTemplateLevel_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `WorkflowTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowTemplateApprover` ADD CONSTRAINT `WorkflowTemplateApprover_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `WorkflowTemplateLevel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecurityOperationalEmployee` ADD CONSTRAINT `SecurityOperationalEmployee_sourceEmployeeId_fkey` FOREIGN KEY (`sourceEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacCheckpoint` ADD CONSTRAINT `SecfacCheckpoint_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `ManpowerClient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacCheckpoint` ADD CONSTRAINT `SecfacCheckpoint_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ManpowerProject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacCheckpoint` ADD CONSTRAINT `SecfacCheckpoint_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacCheckpoint` ADD CONSTRAINT `SecfacCheckpoint_locationUnitId_fkey` FOREIGN KEY (`locationUnitId`) REFERENCES `ManpowerLocationUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistTemplate` ADD CONSTRAINT `SecfacChecklistTemplate_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `ManpowerClient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistTemplate` ADD CONSTRAINT `SecfacChecklistTemplate_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ManpowerProject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistTemplate` ADD CONSTRAINT `SecfacChecklistTemplate_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistTemplate` ADD CONSTRAINT `SecfacChecklistTemplate_locationUnitId_fkey` FOREIGN KEY (`locationUnitId`) REFERENCES `ManpowerLocationUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistTemplate` ADD CONSTRAINT `SecfacChecklistTemplate_checkpointId_fkey` FOREIGN KEY (`checkpointId`) REFERENCES `SecfacCheckpoint`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistItem` ADD CONSTRAINT `SecfacChecklistItem_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `SecfacChecklistTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacAssignment` ADD CONSTRAINT `SecfacAssignment_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `ManpowerClient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacAssignment` ADD CONSTRAINT `SecfacAssignment_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ManpowerProject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacAssignment` ADD CONSTRAINT `SecfacAssignment_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacAssignment` ADD CONSTRAINT `SecfacAssignment_locationUnitId_fkey` FOREIGN KEY (`locationUnitId`) REFERENCES `ManpowerLocationUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacAssignment` ADD CONSTRAINT `SecfacAssignment_checkpointId_fkey` FOREIGN KEY (`checkpointId`) REFERENCES `SecfacCheckpoint`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacAssignment` ADD CONSTRAINT `SecfacAssignment_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `SecfacChecklistTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacAssignment` ADD CONSTRAINT `SecfacAssignment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacAssignment` ADD CONSTRAINT `SecfacAssignment_supervisorId_fkey` FOREIGN KEY (`supervisorId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacAssignment` ADD CONSTRAINT `SecfacAssignment_patrolRouteId_fkey` FOREIGN KEY (`patrolRouteId`) REFERENCES `SecfacPatrolRoute`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistExecution` ADD CONSTRAINT `SecfacChecklistExecution_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `SecfacAssignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistExecution` ADD CONSTRAINT `SecfacChecklistExecution_checklistTemplateId_fkey` FOREIGN KEY (`checklistTemplateId`) REFERENCES `SecfacChecklistTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistExecution` ADD CONSTRAINT `SecfacChecklistExecution_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistExecution` ADD CONSTRAINT `SecfacChecklistExecution_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistExecution` ADD CONSTRAINT `SecfacChecklistExecution_checkpointId_fkey` FOREIGN KEY (`checkpointId`) REFERENCES `SecfacCheckpoint`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistExecution` ADD CONSTRAINT `SecfacChecklistExecution_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistResponse` ADD CONSTRAINT `SecfacChecklistResponse_executionId_fkey` FOREIGN KEY (`executionId`) REFERENCES `SecfacChecklistExecution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistResponse` ADD CONSTRAINT `SecfacChecklistResponse_checklistItemId_fkey` FOREIGN KEY (`checklistItemId`) REFERENCES `SecfacChecklistItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistExecutionHistory` ADD CONSTRAINT `SecfacChecklistExecutionHistory_executionId_fkey` FOREIGN KEY (`executionId`) REFERENCES `SecfacChecklistExecution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacChecklistExecutionHistory` ADD CONSTRAINT `SecfacChecklistExecutionHistory_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacEvidenceAttachment` ADD CONSTRAINT `SecfacEvidenceAttachment_executionId_fkey` FOREIGN KEY (`executionId`) REFERENCES `SecfacChecklistExecution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacEvidenceAttachment` ADD CONSTRAINT `SecfacEvidenceAttachment_responseId_fkey` FOREIGN KEY (`responseId`) REFERENCES `SecfacChecklistResponse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacEvidenceAttachment` ADD CONSTRAINT `SecfacEvidenceAttachment_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `SecfacAssignment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacEvidenceAttachment` ADD CONSTRAINT `SecfacEvidenceAttachment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacEvidenceAttachment` ADD CONSTRAINT `SecfacEvidenceAttachment_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacEvidenceAttachment` ADD CONSTRAINT `SecfacEvidenceAttachment_checkpointId_fkey` FOREIGN KEY (`checkpointId`) REFERENCES `SecfacCheckpoint`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacEvidenceAttachment` ADD CONSTRAINT `SecfacEvidenceAttachment_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacScanProof` ADD CONSTRAINT `SecfacScanProof_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `SecfacAssignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacScanProof` ADD CONSTRAINT `SecfacScanProof_executionId_fkey` FOREIGN KEY (`executionId`) REFERENCES `SecfacChecklistExecution`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacScanProof` ADD CONSTRAINT `SecfacScanProof_checkpointId_fkey` FOREIGN KEY (`checkpointId`) REFERENCES `SecfacCheckpoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacScanProof` ADD CONSTRAINT `SecfacScanProof_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacScanProof` ADD CONSTRAINT `SecfacScanProof_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacScanProof` ADD CONSTRAINT `SecfacScanProof_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacPatrolRoute` ADD CONSTRAINT `SecfacPatrolRoute_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacPatrolRouteCheckpoint` ADD CONSTRAINT `SecfacPatrolRouteCheckpoint_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `SecfacPatrolRoute`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacPatrolRouteCheckpoint` ADD CONSTRAINT `SecfacPatrolRouteCheckpoint_checkpointId_fkey` FOREIGN KEY (`checkpointId`) REFERENCES `SecfacCheckpoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacPatrolExecution` ADD CONSTRAINT `SecfacPatrolExecution_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `SecfacPatrolRoute`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacPatrolExecution` ADD CONSTRAINT `SecfacPatrolExecution_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `SecfacAssignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacPatrolExecution` ADD CONSTRAINT `SecfacPatrolExecution_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacPatrolExecutionCheckpoint` ADD CONSTRAINT `SecfacPatrolExecutionCheckpoint_executionId_fkey` FOREIGN KEY (`executionId`) REFERENCES `SecfacPatrolExecution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacPatrolExecutionCheckpoint` ADD CONSTRAINT `SecfacPatrolExecutionCheckpoint_checkpointId_fkey` FOREIGN KEY (`checkpointId`) REFERENCES `SecfacCheckpoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacPatrolExecutionCheckpoint` ADD CONSTRAINT `SecfacPatrolExecutionCheckpoint_scanProofId_fkey` FOREIGN KEY (`scanProofId`) REFERENCES `SecfacScanProof`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacSyncConflict` ADD CONSTRAINT `SecfacSyncConflict_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecfacFieldExecutionAudit` ADD CONSTRAINT `SecfacFieldExecutionAudit_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


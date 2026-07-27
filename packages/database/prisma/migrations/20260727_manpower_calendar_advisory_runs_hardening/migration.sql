-- Forward-only repair migration: Hardening advisory calendar governance, scopeKey uniqueness, idempotency, and employee-day evidence

-- 1. ManpowerWorkCalendarProfile adjustments
ALTER TABLE `ManpowerWorkCalendarProfile`
  MODIFY `weeklyRestFixedDay` VARCHAR(191) NULL,
  MODIFY `effectiveTo` DATE NULL,
  ADD COLUMN `createdById` VARCHAR(191) NULL;

-- 2. ManpowerRamadanPeriod adjustments (removing year uniqueness, adding versioning)
ALTER TABLE `ManpowerRamadanPeriod`
  DROP INDEX `ManpowerRamadanPeriod_year_key`,
  ADD COLUMN `approvedById` VARCHAR(191) NULL,
  ADD COLUMN `createdById` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `ManpowerRamadanPeriod_year_version_key` (`year`, `version`);

-- 3. ManpowerHolidayCalendar adjustments (scopeKey normalization & uniqueness)
ALTER TABLE `ManpowerHolidayCalendar`
  DROP INDEX `ManpowerHolidayCalendar_year_scope_version_key`,
  ADD COLUMN `scopeKey` VARCHAR(191) NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN `effectiveFrom` DATE NULL,
  ADD COLUMN `effectiveTo` DATE NULL,
  ADD COLUMN `sourceReference` VARCHAR(191) NULL,
  ADD COLUMN `approvedById` VARCHAR(191) NULL,
  ADD COLUMN `createdById` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `ManpowerHolidayCalendar_scopeKey_year_scope_version_key` (`scopeKey`, `year`, `scope`, `version`);

UPDATE `ManpowerHolidayCalendar`
  SET `scopeKey` = IF(`companyId` IS NOT NULL AND `companyId` != '', CONCAT('COMPANY:', `companyId`), 'GLOBAL');

-- 4. ManpowerHolidayDate adjustments
ALTER TABLE `ManpowerHolidayDate`
  ALTER COLUMN `approvalStatus` SET DEFAULT 'DRAFT',
  ADD COLUMN `createdById` VARCHAR(191) NULL;

-- 5. ManpowerBillingSupportRun adjustments (idempotency, hash, correlation)
ALTER TABLE `ManpowerBillingSupportRun`
  ADD COLUMN `idempotencyKey` VARCHAR(191) NULL,
  ADD COLUMN `requestHash` VARCHAR(191) NULL,
  ADD COLUMN `correlationId` VARCHAR(191) NULL,
  ADD COLUMN `fromDate` DATE NULL,
  ADD COLUMN `toDate` DATE NULL,
  ADD COLUMN `calculationVersion` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `workCalendarProfileId` VARCHAR(191) NULL,
  ADD COLUMN `ramadanPeriodId` VARCHAR(191) NULL,
  ADD COLUMN `holidayCalendarId` VARCHAR(191) NULL,
  ADD COLUMN `sourceVersionJson` JSON NULL,
  ADD COLUMN `exportedById` VARCHAR(191) NULL,
  ADD COLUMN `exportedAt` DATETIME(3) NULL,
  ADD UNIQUE INDEX `ManpowerBillingSupportRun_idempotencyKey_key` (`idempotencyKey`);

-- 6. ManpowerBillingSupportLine adjustments (FOC reliever & relational evidence)
ALTER TABLE `ManpowerBillingSupportLine`
  ADD COLUMN `shiftRequirementId` VARCHAR(191) NULL,
  ADD COLUMN `requirementSeriesId` VARCHAR(191) NULL,
  ADD COLUMN `locationUnitId` VARCHAR(191) NULL,
  ADD COLUMN `postId` VARCHAR(191) NULL,
  ADD COLUMN `zoneId` VARCHAR(191) NULL,
  ADD COLUMN `requiredPositionCategoryId` VARCHAR(191) NULL,
  ADD COLUMN `slotIndex` INTEGER NULL,
  ADD COLUMN `publicationId` VARCHAR(191) NULL,
  ADD COLUMN `assignmentId` VARCHAR(191) NULL,
  ADD COLUMN `attendanceId` VARCHAR(191) NULL,
  ADD COLUMN `reconciliationId` VARCHAR(191) NULL,
  ADD COLUMN `baseBillableAdvisoryQty` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `additionalRelieverAdvisoryQty` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `relieverCommercialClassification` VARCHAR(191) NULL,
  ADD COLUMN `contractEvidenceJson` JSON NULL;

-- 7. ManpowerPayrollAdvisoryRun adjustments
ALTER TABLE `ManpowerPayrollAdvisoryRun`
  ADD COLUMN `idempotencyKey` VARCHAR(191) NULL,
  ADD COLUMN `requestHash` VARCHAR(191) NULL,
  ADD COLUMN `correlationId` VARCHAR(191) NULL,
  ADD COLUMN `fromDate` DATE NULL,
  ADD COLUMN `toDate` DATE NULL,
  ADD COLUMN `calculationVersion` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `workCalendarProfileId` VARCHAR(191) NULL,
  ADD COLUMN `ramadanPeriodId` VARCHAR(191) NULL,
  ADD COLUMN `holidayCalendarId` VARCHAR(191) NULL,
  ADD COLUMN `sourceVersionJson` JSON NULL,
  ADD COLUMN `exportedById` VARCHAR(191) NULL,
  ADD COLUMN `exportedAt` DATETIME(3) NULL,
  ADD UNIQUE INDEX `ManpowerPayrollAdvisoryRun_idempotencyKey_key` (`idempotencyKey`);

-- 8. ManpowerPayrollAdvisoryLine adjustments
ALTER TABLE `ManpowerPayrollAdvisoryLine`
  ALTER COLUMN `readinessStatus` SET DEFAULT 'DATA_INCOMPLETE';

-- 9. ManpowerPayrollAdvisoryDay creation
CREATE TABLE `ManpowerPayrollAdvisoryDay` (
  `id` VARCHAR(191) NOT NULL,
  `lineId` VARCHAR(191) NOT NULL,
  `businessDate` DATE NOT NULL,
  `assignmentId` VARCHAR(191) NULL,
  `requirementSlotId` VARCHAR(191) NULL,
  `siteId` VARCHAR(191) NULL,
  `regularMinutes` INTEGER NOT NULL DEFAULT 0,
  `ramadanMinutes` INTEGER NOT NULL DEFAULT 0,
  `overtimeCandidateMinutes` INTEGER NOT NULL DEFAULT 0,
  `publicHolidayMinutes` INTEGER NOT NULL DEFAULT 0,
  `weeklyRestMinutes` INTEGER NOT NULL DEFAULT 0,
  `actingDutyCandidateMinutes` INTEGER NOT NULL DEFAULT 0,
  `siteAllowanceCandidate` BOOLEAN NOT NULL DEFAULT false,
  `leaveClassification` VARCHAR(191) NULL,
  `absenceClassification` VARCHAR(191) NULL,
  `attendanceEvidenceJson` JSON NULL,
  `reconciliationEvidenceJson` JSON NULL,
  `warningCodes` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `ManpowerPayrollAdvisoryDay_lineId_businessDate_assignmentId_idx` (`lineId`, `businessDate`, `assignmentId`),
  INDEX `ManpowerPayrollAdvisoryDay_siteId_businessDate_idx` (`siteId`, `businessDate`),
  CONSTRAINT `ManpowerPayrollAdvisoryDay_lineId_fkey` FOREIGN KEY (`lineId`) REFERENCES `ManpowerPayrollAdvisoryLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

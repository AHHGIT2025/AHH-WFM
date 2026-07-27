-- AlterTable ManpowerWorkCalendarProfile
ALTER TABLE `ManpowerWorkCalendarProfile`
  MODIFY `operationType` ENUM('SECURITY_GUARDING', 'FACILITY_MANAGEMENT') NOT NULL,
  MODIFY `workerCategory` ENUM('GENERAL', 'SECURITY_GUARDING', 'CLEANING', 'OTHER_FACILITY_MANAGEMENT', 'WHITE_COLLAR') NOT NULL,
  MODIFY `weeklyRestConfigType` ENUM('FIXED_DAY', 'ROTATING', 'CUSTOM_SCHEDULE') NOT NULL DEFAULT 'FIXED_DAY',
  MODIFY `approvalStatus` ENUM('DRAFT', 'APPROVED', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable ManpowerRamadanPeriod
ALTER TABLE `ManpowerRamadanPeriod`
  MODIFY `approvalStatus` ENUM('DRAFT', 'APPROVED', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable ManpowerHolidayCalendar
ALTER TABLE `ManpowerHolidayCalendar`
  MODIFY `approvalStatus` ENUM('DRAFT', 'APPROVED', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable ManpowerHolidayDate
ALTER TABLE `ManpowerHolidayDate`
  MODIFY `holidayType` ENUM('NATIONAL', 'RELIGIOUS', 'EMPLOYER_DESIGNATED', 'SPECIAL') NOT NULL DEFAULT 'NATIONAL',
  MODIFY `approvalStatus` ENUM('DRAFT', 'APPROVED', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable ManpowerBillingSupportRun
DROP INDEX `ManpowerBillingSupportRun_idempotencyKey_key` ON `ManpowerBillingSupportRun`;

ALTER TABLE `ManpowerBillingSupportRun`
  ADD COLUMN `runScopeKey` VARCHAR(191) NOT NULL DEFAULT 'GLOBAL',
  MODIFY `operationType` ENUM('SECURITY_GUARDING', 'FACILITY_MANAGEMENT') NOT NULL,
  MODIFY `status` ENUM('DRAFT', 'CALCULATED', 'REVIEWED', 'LOCKED', 'EXPORTED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT';

CREATE UNIQUE INDEX `ManpowerBillingSupportRun_scope_op_idemp_key` ON `ManpowerBillingSupportRun`(`runScopeKey`, `operationType`, `idempotencyKey`);
CREATE INDEX `ManpowerBillingSupportRun_runScopeKey_operationType_idx` ON `ManpowerBillingSupportRun`(`runScopeKey`, `operationType`);

-- AlterTable ManpowerBillingSupportLine
ALTER TABLE `ManpowerBillingSupportLine`
  MODIFY `billingBasis` ENUM('PLANNED_VS_ACTUAL_ATTENDANCE', 'PLANNED_POST_CONTRACT', 'SHIFT_RATE', 'HOURLY_RATE', 'MONTHLY_LUMP_SUM', 'COMMERCIAL_RULE_NOT_CONFIGURED') NOT NULL DEFAULT 'PLANNED_VS_ACTUAL_ATTENDANCE';

-- AlterTable ManpowerPayrollAdvisoryRun
DROP INDEX `ManpowerPayrollAdvisoryRun_idempotencyKey_key` ON `ManpowerPayrollAdvisoryRun`;

ALTER TABLE `ManpowerPayrollAdvisoryRun`
  ADD COLUMN `runScopeKey` VARCHAR(191) NOT NULL DEFAULT 'GLOBAL',
  MODIFY `operationType` ENUM('SECURITY_GUARDING', 'FACILITY_MANAGEMENT') NOT NULL,
  MODIFY `status` ENUM('DRAFT', 'CALCULATED', 'REVIEWED', 'LOCKED', 'EXPORTED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT';

CREATE UNIQUE INDEX `ManpowerPayrollAdvisoryRun_scope_op_idemp_key` ON `ManpowerPayrollAdvisoryRun`(`runScopeKey`, `operationType`, `idempotencyKey`);
CREATE INDEX `ManpowerPayrollAdvisoryRun_runScopeKey_operationType_idx` ON `ManpowerPayrollAdvisoryRun`(`runScopeKey`, `operationType`);

-- AlterTable ManpowerPayrollAdvisoryLine
ALTER TABLE `ManpowerPayrollAdvisoryLine`
  MODIFY `reconciliationStatus` ENUM('MATCHED', 'UNMATCHED', 'PENDING_RECONCILIATION') NOT NULL DEFAULT 'MATCHED';

-- AlterTable ManpowerPayrollAdvisoryDay
ALTER TABLE `ManpowerPayrollAdvisoryDay`
  ADD COLUMN `evidenceGroupKey` VARCHAR(191) NOT NULL DEFAULT 'PRIMARY';

CREATE UNIQUE INDEX `ManpowerPayrollAdvisoryDay_line_date_group_key` ON `ManpowerPayrollAdvisoryDay`(`lineId`, `businessDate`, `evidenceGroupKey`);

-- Drop legacy FKs to replace with ON DELETE RESTRICT
ALTER TABLE `ManpowerWorkCalendarProfile` DROP FOREIGN KEY `ManpowerWorkCalendarProfile_companyId_fkey`;
ALTER TABLE `ManpowerHolidayCalendar` DROP FOREIGN KEY `ManpowerHolidayCalendar_companyId_fkey`;

-- Add Foreign Keys
ALTER TABLE `ManpowerWorkCalendarProfile` ADD CONSTRAINT `ManpowerWorkCalendarProfile_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerWorkCalendarProfile` ADD CONSTRAINT `ManpowerWorkCalendarProfile_supersedesProfileId_fkey` FOREIGN KEY (`supersedesProfileId`) REFERENCES `ManpowerWorkCalendarProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ManpowerRamadanPeriod` ADD CONSTRAINT `ManpowerRamadanPeriod_supersedesPeriodId_fkey` FOREIGN KEY (`supersedesPeriodId`) REFERENCES `ManpowerRamadanPeriod`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ManpowerHolidayCalendar` ADD CONSTRAINT `ManpowerHolidayCalendar_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerHolidayCalendar` ADD CONSTRAINT `ManpowerHolidayCalendar_supersedesCalendarId_fkey` FOREIGN KEY (`supersedesCalendarId`) REFERENCES `ManpowerHolidayCalendar`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ManpowerBillingSupportRun` ADD CONSTRAINT `ManpowerBillingSupportRun_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerBillingSupportRun` ADD CONSTRAINT `ManpowerBillingSupportRun_workCalendarProfileId_fkey` FOREIGN KEY (`workCalendarProfileId`) REFERENCES `ManpowerWorkCalendarProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerBillingSupportRun` ADD CONSTRAINT `ManpowerBillingSupportRun_ramadanPeriodId_fkey` FOREIGN KEY (`ramadanPeriodId`) REFERENCES `ManpowerRamadanPeriod`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerBillingSupportRun` ADD CONSTRAINT `ManpowerBillingSupportRun_holidayCalendarId_fkey` FOREIGN KEY (`holidayCalendarId`) REFERENCES `ManpowerHolidayCalendar`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerBillingSupportRun` ADD CONSTRAINT `ManpowerBillingSupportRun_supersedesRunId_fkey` FOREIGN KEY (`supersedesRunId`) REFERENCES `ManpowerBillingSupportRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ManpowerPayrollAdvisoryRun` ADD CONSTRAINT `ManpowerPayrollAdvisoryRun_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerPayrollAdvisoryRun` ADD CONSTRAINT `ManpowerPayrollAdvisoryRun_workCalendarProfileId_fkey` FOREIGN KEY (`workCalendarProfileId`) REFERENCES `ManpowerWorkCalendarProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerPayrollAdvisoryRun` ADD CONSTRAINT `ManpowerPayrollAdvisoryRun_ramadanPeriodId_fkey` FOREIGN KEY (`ramadanPeriodId`) REFERENCES `ManpowerRamadanPeriod`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerPayrollAdvisoryRun` ADD CONSTRAINT `ManpowerPayrollAdvisoryRun_holidayCalendarId_fkey` FOREIGN KEY (`holidayCalendarId`) REFERENCES `ManpowerHolidayCalendar`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerPayrollAdvisoryRun` ADD CONSTRAINT `ManpowerPayrollAdvisoryRun_supersedesRunId_fkey` FOREIGN KEY (`supersedesRunId`) REFERENCES `ManpowerPayrollAdvisoryRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

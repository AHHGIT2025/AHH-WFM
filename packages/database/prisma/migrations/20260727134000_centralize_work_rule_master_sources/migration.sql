-- Expand-backfill-contract migration for Phase MD-1: Centralize Work-Rule Master Sources

-- 1. Add new columns to Company
ALTER TABLE `Company` ADD COLUMN `isHoldingCompany` BOOLEAN NOT NULL DEFAULT false;

-- 2. Modify ManpowerWorkCalendarProfile columns (expand phase as nullable first)
ALTER TABLE `ManpowerWorkCalendarProfile`
  DROP FOREIGN KEY `ManpowerWorkCalendarProfile_companyId_fkey`,
  MODIFY `operationType` VARCHAR(191) NULL,
  MODIFY `workerCategory` VARCHAR(191) NULL,
  ADD COLUMN `ownerCompanyId` VARCHAR(191) NULL,
  ADD COLUMN `workerClass` VARCHAR(191) NULL,
  ADD COLUMN `applicability` VARCHAR(191) NULL,
  ADD COLUMN `applicableCompanyId` VARCHAR(191) NULL,
  ADD COLUMN `departmentId` VARCHAR(191) NULL,
  ADD COLUMN `appliesToAllPositionCategories` BOOLEAN NULL,
  ADD COLUMN `positionCategoryId` VARCHAR(191) NULL,
  ADD COLUMN `ramadanExcessCreatesOtCandidate` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `weeklyRestSource` VARCHAR(191) NULL;

-- 3. Backfill deterministic legacy profiles
UPDATE `ManpowerWorkCalendarProfile`
SET `workerClass` = 'WHITE_COLLAR',
    `applicability` = 'COMPANY',
    `weeklyRestSource` = 'PROFILE_FIXED_DAYS',
    `applicableCompanyId` = `companyId`
WHERE `workerCategory` = 'WHITE_COLLAR' OR `operationType` = 'WHITE_COLLAR';

UPDATE `ManpowerWorkCalendarProfile`
SET `workerClass` = 'BLUE_COLLAR',
    `applicability` = 'COMPANY',
    `weeklyRestSource` = 'ROSTER_MANAGED',
    `appliesToAllPositionCategories` = true,
    `applicableCompanyId` = `companyId`
WHERE `workerCategory` IN ('SECURITY_GUARDING', 'CLEANING', 'OTHER_FACILITY_MANAGEMENT', 'GENERAL');

-- Backfill ownerCompanyId from companyId or Holding Company
UPDATE `ManpowerWorkCalendarProfile`
SET `ownerCompanyId` = `companyId`
WHERE `ownerCompanyId` IS NULL AND `companyId` IS NOT NULL;

-- Backfill Holding Company singleton flag on AL Hattab Holding (companyCode '1000')
UPDATE `Company`
SET `isHoldingCompany` = true
WHERE `companyCode` = '1000';

-- Complete ownerCompanyId backfill for any remaining profiles
UPDATE `ManpowerWorkCalendarProfile` p
JOIN `Company` c ON c.`isHoldingCompany` = true
SET p.`ownerCompanyId` = c.`id`
WHERE p.`ownerCompanyId` IS NULL;

-- 4. Create Operation Scope Mappings tables
CREATE TABLE `ManpowerCompanyOperationScope` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `operationType` ENUM('SECURITY_GUARDING', 'FACILITY_MANAGEMENT') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManpowerCompanyOperationScope_companyId_operationType_key`(`companyId`, `operationType`),
    INDEX `ManpowerCompanyOperationScope_companyId_isActive_idx`(`companyId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ManpowerDepartmentOperationScope` (
    `id` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `operationType` ENUM('SECURITY_GUARDING', 'FACILITY_MANAGEMENT') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ManpowerDepartmentOperationScope_departmentId_operationType_key`(`departmentId`, `operationType`),
    INDEX `ManpowerDepartmentOperationScope_departmentId_isActive_idx`(`departmentId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. Create Work Calendar Rest Days table
CREATE TABLE `ManpowerWorkCalendarRestDay` (
    `id` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,
    `dayOfWeek` ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,

    UNIQUE INDEX `ManpowerWorkCalendarRestDay_profileId_dayOfWeek_key`(`profileId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill deterministic rest days for approved White Collar profiles with fixed Friday
INSERT INTO `ManpowerWorkCalendarRestDay` (`id`, `profileId`, `dayOfWeek`)
SELECT UUID(), `id`, 'FRIDAY'
FROM `ManpowerWorkCalendarProfile`
WHERE `workerClass` = 'WHITE_COLLAR' AND (`weeklyRestFixedDay` = 'FRIDAY' OR `weeklyRestFixedDay` IS NULL);

-- 6. Create Seasonal Work Rules table
CREATE TABLE `ManpowerSeasonalWorkRule` (
    `id` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `positionCategoryId` VARCHAR(191) NULL,
    `ruleScope` ENUM('COMPANY_WIDE', 'POSITION_CATEGORY', 'PROFILE_SPECIFIC') NOT NULL,
    `ruleType` ENUM('SUMMER_WORKING_HOURS', 'OTHER_APPROVED_CONDITION') NOT NULL,
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NOT NULL,
    `morningStartMinutes` INTEGER NOT NULL,
    `morningEndMinutes` INTEGER NOT NULL,
    `mandatoryBreakStartMinutes` INTEGER NOT NULL,
    `mandatoryBreakEndMinutes` INTEGER NOT NULL,
    `eveningStartMinutes` INTEGER NULL,
    `eveningEndMinutes` INTEGER NULL,
    `allowedDailyMinutes` INTEGER NOT NULL,
    `sourceReference` VARCHAR(191) NULL,
    `approvalStatus` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `supersedesRuleId` VARCHAR(191) NULL,
    `supersededAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ManpowerSeasonalWorkRule_companyId_ruleType_effectiveFrom_ef_idx`(`companyId`, `ruleType`, `effectiveFrom`, `effectiveTo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 7. Create Roster Day Classification & History tables
CREATE TABLE `ManpowerRosterDayClassification` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `businessDate` DATE NOT NULL,
    `classification` ENUM('WORKING_DAY', 'WEEKLY_REST', 'UNASSIGNED', 'NOT_SCHEDULED') NOT NULL,
    `publicationId` VARCHAR(191) NULL,
    `publicationVersion` INTEGER NOT NULL DEFAULT 1,
    `sourceType` ENUM('ROSTER_PUBLICATION', 'REQUIREMENT_SLOT', 'SLOT_ASSIGNMENT', 'AUTHORIZED_CORRECTION', 'MIGRATION_BACKFILL') NOT NULL,
    `sourceVersion` INTEGER NOT NULL,
    `creatorId` VARCHAR(191) NULL,
    `sourceRequirementSlotId` VARCHAR(191) NULL,
    `sourceSlotAssignmentId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ManpowerRosterDayClassification_businessDate_classification_idx`(`businessDate`, `classification`),
    UNIQUE INDEX `ManpowerRosterDayClassification_employeeId_businessDate_key`(`employeeId`, `businessDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ManpowerRosterDayClassificationHistory` (
    `id` VARCHAR(191) NOT NULL,
    `classificationId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `businessDate` DATE NOT NULL,
    `classification` ENUM('WORKING_DAY', 'WEEKLY_REST', 'UNASSIGNED', 'NOT_SCHEDULED') NOT NULL,
    `sourceType` ENUM('ROSTER_PUBLICATION', 'REQUIREMENT_SLOT', 'SLOT_ASSIGNMENT', 'AUTHORIZED_CORRECTION', 'MIGRATION_BACKFILL') NOT NULL,
    `sourceVersion` INTEGER NOT NULL,
    `archivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `archivedBy` VARCHAR(191) NULL,
    `notes` TEXT NULL,

    INDEX `ManpowerRosterDayClassificationHistory_employeeId_businessDa_idx`(`employeeId`, `businessDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 8. Contract phase: Enforce NOT NULL on ownerCompanyId, workerClass, applicability, weeklyRestSource
ALTER TABLE `ManpowerWorkCalendarProfile`
  MODIFY `ownerCompanyId` VARCHAR(191) NOT NULL,
  MODIFY `workerClass` ENUM('WHITE_COLLAR', 'BLUE_COLLAR') NOT NULL,
  MODIFY `applicability` ENUM('GROUP_WIDE', 'COMPANY', 'DEPARTMENT') NOT NULL,
  MODIFY `weeklyRestSource` ENUM('PROFILE_FIXED_DAYS', 'ROSTER_MANAGED') NOT NULL;

-- 9. Add indexes and foreign keys
CREATE INDEX `ManpowerWorkCalendarProfile_workerClass_applicability_approv_idx` ON `ManpowerWorkCalendarProfile`(`workerClass`, `applicability`, `approvalStatus`);
CREATE INDEX `ManpowerWorkCalendarProfile_applicableCompanyId_departmentId_idx` ON `ManpowerWorkCalendarProfile`(`applicableCompanyId`, `departmentId`);

ALTER TABLE `ManpowerCompanyOperationScope` ADD CONSTRAINT `ManpowerCompanyOperationScope_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerDepartmentOperationScope` ADD CONSTRAINT `ManpowerDepartmentOperationScope_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerWorkCalendarProfile` ADD CONSTRAINT `ManpowerWorkCalendarProfile_ownerCompanyId_fkey` FOREIGN KEY (`ownerCompanyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerWorkCalendarProfile` ADD CONSTRAINT `ManpowerWorkCalendarProfile_applicableCompanyId_fkey` FOREIGN KEY (`applicableCompanyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerWorkCalendarProfile` ADD CONSTRAINT `ManpowerWorkCalendarProfile_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerWorkCalendarProfile` ADD CONSTRAINT `ManpowerWorkCalendarProfile_positionCategoryId_fkey` FOREIGN KEY (`positionCategoryId`) REFERENCES `BlueCollarPositionCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerWorkCalendarRestDay` ADD CONSTRAINT `ManpowerWorkCalendarRestDay_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `ManpowerWorkCalendarProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ManpowerSeasonalWorkRule` ADD CONSTRAINT `ManpowerSeasonalWorkRule_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `ManpowerWorkCalendarProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerSeasonalWorkRule` ADD CONSTRAINT `ManpowerSeasonalWorkRule_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerSeasonalWorkRule` ADD CONSTRAINT `ManpowerSeasonalWorkRule_positionCategoryId_fkey` FOREIGN KEY (`positionCategoryId`) REFERENCES `BlueCollarPositionCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerSeasonalWorkRule` ADD CONSTRAINT `ManpowerSeasonalWorkRule_supersedesRuleId_fkey` FOREIGN KEY (`supersedesRuleId`) REFERENCES `ManpowerSeasonalWorkRule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerRosterDayClassification` ADD CONSTRAINT `ManpowerRosterDayClassification_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ManpowerRosterDayClassificationHistory` ADD CONSTRAINT `ManpowerRosterDayClassificationHistory_classificationId_fkey` FOREIGN KEY (`classificationId`) REFERENCES `ManpowerRosterDayClassification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

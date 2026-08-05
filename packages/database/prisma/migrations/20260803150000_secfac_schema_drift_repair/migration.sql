-- secfac_schema_drift_repair
--
-- This migration resolves schema drift introduced when migration
-- 20260730063056_pc2a_cost_master_admin was deleted without replacement.
--
-- Safe to apply on:
--   A) ahh_wfm_jest / ahh_wfm_disposable_partial (pc2a_clean + welfare_reconciliation applied)
--   B) ahh_wfm SERVER clone (pc2a_scoped_additive + welfare_reconciliation applied)
--
-- The CostElementMaster/CostFormulaDefinition FK changes are idempotent:
--   - On path A (pc2a_clean): FKs are already SET NULL; drop+re-add is a no-op.
--   - On path B (pc2a_scoped_additive): FKs are RESTRICT; this corrects them to SET NULL.

-- DropForeignKey (SecFacWelfareCheck legacy FKs)
ALTER TABLE `SecFacWelfareCheck` DROP FOREIGN KEY `SecFacWelfareCheck_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `SecFacWelfareCheck` DROP FOREIGN KEY `SecFacWelfareCheck_deploymentId_fkey`;

-- DropForeignKey
ALTER TABLE `SecFacWelfareCheck` DROP FOREIGN KEY `SecFacWelfareCheck_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `SecFacWelfareCheck` DROP FOREIGN KEY `SecFacWelfareCheck_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `SecFacWelfareCheck` DROP FOREIGN KEY `SecFacWelfareCheck_siteId_fkey`;

-- DropForeignKey (SecFacWelfareSetting legacy FKs)
ALTER TABLE `SecFacWelfareSetting` DROP FOREIGN KEY `SecFacWelfareSetting_companyId_fkey`;

-- DropForeignKey
ALTER TABLE `SecFacWelfareSetting` DROP FOREIGN KEY `SecFacWelfareSetting_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `SecFacWelfareSetting` DROP FOREIGN KEY `SecFacWelfareSetting_projectId_fkey`;

-- DropForeignKey
ALTER TABLE `SecFacWelfareSetting` DROP FOREIGN KEY `SecFacWelfareSetting_siteId_fkey`;

-- DropForeignKey (SecfacPatrolExecutionCheckpoint alertId FK — alert entity removed)
ALTER TABLE `SecfacPatrolExecutionCheckpoint` DROP FOREIGN KEY `SecfacPatrolExecutionCheckpoint_alertId_fkey`;

-- DropForeignKey (CostElementMaster versionId: RESTRICT → SET NULL)
ALTER TABLE `CostElementMaster` DROP FOREIGN KEY `CostElementMaster_versionId_fkey`;

-- DropForeignKey (CostFormulaDefinition versionId: RESTRICT → SET NULL)
ALTER TABLE `CostFormulaDefinition` DROP FOREIGN KEY `CostFormulaDefinition_versionId_fkey`;

-- AlterTable: make assignedRosterType nullable (was Required, schema now Optional with default)
ALTER TABLE `RosterSlotAssignment` MODIFY `assignedRosterType` VARCHAR(191) NULL DEFAULT 'PRIMARY';

-- AlterTable: SecFacWelfareCheck column corrections
ALTER TABLE `SecFacWelfareCheck`
    MODIFY `exemptionReason` TEXT NULL,
    MODIFY `settingSourceType` ENUM('POST', 'SITE', 'PROJECT', 'COMPANY', 'SYSTEM_DEFAULT') NOT NULL DEFAULT 'SYSTEM_DEFAULT';

-- AlterTable: SecFacWelfareSetting column corrections
ALTER TABLE `SecFacWelfareSetting`
    MODIFY `companyId` VARCHAR(191) NOT NULL,
    MODIFY `sourceType` ENUM('POST', 'SITE', 'PROJECT', 'COMPANY', 'SYSTEM_DEFAULT') NULL,
    MODIFY `createdById` VARCHAR(191) NOT NULL;

-- AlterTable: SecfacEvidenceAttachment type corrections (columns added by welfare_reconciliation)
ALTER TABLE `SecfacEvidenceAttachment`
    MODIFY `hashAlgorithm` VARCHAR(191) NULL DEFAULT 'SHA-256',
    MODIFY `integrityStatus` ENUM('VERIFIED', 'MISMATCH', 'UNVERIFIED') NOT NULL DEFAULT 'UNVERIFIED';

-- AlterTable: SecfacPatrolRoute sequenceMode type correction (ENUM → VARCHAR for flexibility)
ALTER TABLE `SecfacPatrolRoute` MODIFY `sequenceMode` VARCHAR(191) NOT NULL DEFAULT 'MANDATORY';

-- CreateIndex
CREATE INDEX `SecFacWelfareSetting_operationType_idx` ON `SecFacWelfareSetting`(`operationType`);

-- CreateIndex
CREATE INDEX `SecFacWelfareSetting_isActive_idx` ON `SecFacWelfareSetting`(`isActive`);

-- CreateIndex
CREATE INDEX `SecfacEvidenceAttachment_integrityStatus_idx` ON `SecfacEvidenceAttachment`(`integrityStatus`);

-- CreateIndex
CREATE INDEX `SecfacPatrolExecution_evaluationStatus_idx` ON `SecfacPatrolExecution`(`evaluationStatus`);

-- CreateIndex
CREATE INDEX `SecfacPatrolExecutionCheckpoint_assuranceStatus_idx` ON `SecfacPatrolExecutionCheckpoint`(`assuranceStatus`);

-- AddForeignKey (SecFacWelfareSetting.createdById: restored with RESTRICT)
ALTER TABLE `SecFacWelfareSetting` ADD CONSTRAINT `SecFacWelfareSetting_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (SecFacWelfareCheck.siteId: restored with RESTRICT)
ALTER TABLE `SecFacWelfareCheck` ADD CONSTRAINT `SecFacWelfareCheck_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (SecFacWelfareCheck.employeeId: restored with RESTRICT)
ALTER TABLE `SecFacWelfareCheck` ADD CONSTRAINT `SecFacWelfareCheck_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (CostElementMaster.versionId: corrected to SET NULL)
ALTER TABLE `CostElementMaster` ADD CONSTRAINT `CostElementMaster_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `CostConfigurationVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (CostFormulaDefinition.versionId: corrected to SET NULL)
ALTER TABLE `CostFormulaDefinition` ADD CONSTRAINT `CostFormulaDefinition_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `CostConfigurationVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex (SecFacWelfareSetting: FK-style index names → explicit idx names)
ALTER TABLE `SecFacWelfareSetting` RENAME INDEX `SecFacWelfareSetting_companyId_fkey` TO `SecFacWelfareSetting_companyId_idx`;

-- RenameIndex
ALTER TABLE `SecFacWelfareSetting` RENAME INDEX `SecFacWelfareSetting_siteId_fkey` TO `SecFacWelfareSetting_siteId_idx`;

-- DropIndex (orphaned FK-backing indexes — MySQL retains these after FK is dropped)
-- These were auto-created by MySQL when FKs were added; must be dropped explicitly.
-- Guarded with information_schema checks so this is safe on both migration paths:
--   - pc2a_scoped_additive (live SERVER): orphaned indexes exist → will be dropped.
--   - pc2a_clean (test databases): FKs still active at FK-drop time, but after the
--     DROP FOREIGN KEY statements above, the same orphaned indexes appear here too.

DROP PROCEDURE IF EXISTS _drop_index_if_exists_welfare_repair;
CREATE PROCEDURE _drop_index_if_exists_welfare_repair()
BEGIN
    -- SecFacWelfareCheck_deploymentId_fkey
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'SecFacWelfareCheck'
          AND INDEX_NAME = 'SecFacWelfareCheck_deploymentId_fkey'
    ) THEN
        ALTER TABLE `SecFacWelfareCheck` DROP INDEX `SecFacWelfareCheck_deploymentId_fkey`;
    END IF;

    -- SecFacWelfareCheck_projectId_fkey
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'SecFacWelfareCheck'
          AND INDEX_NAME = 'SecFacWelfareCheck_projectId_fkey'
    ) THEN
        ALTER TABLE `SecFacWelfareCheck` DROP INDEX `SecFacWelfareCheck_projectId_fkey`;
    END IF;

    -- SecFacWelfareSetting_projectId_fkey
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'SecFacWelfareSetting'
          AND INDEX_NAME = 'SecFacWelfareSetting_projectId_fkey'
    ) THEN
        ALTER TABLE `SecFacWelfareSetting` DROP INDEX `SecFacWelfareSetting_projectId_fkey`;
    END IF;

    -- SecfacPatrolExecutionCheckpoint_alertId_fkey
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'SecfacPatrolExecutionCheckpoint'
          AND INDEX_NAME = 'SecfacPatrolExecutionCheckpoint_alertId_fkey'
    ) THEN
        ALTER TABLE `SecfacPatrolExecutionCheckpoint` DROP INDEX `SecfacPatrolExecutionCheckpoint_alertId_fkey`;
    END IF;
END;

CALL _drop_index_if_exists_welfare_repair();
DROP PROCEDURE IF EXISTS _drop_index_if_exists_welfare_repair;

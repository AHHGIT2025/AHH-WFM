-- secfac_schema_drift_repair
--
-- State-aware drift repair migration.
-- Handles all potential starting states safely:
--   - Fresh empty database
--   - Populated baseline database
--   - Pre-repair live SERVER database (where some legacy FKs like SecFacWelfareCheck_companyId_fkey are absent)
--   - Failed live SERVER database (recovery path)

DROP PROCEDURE IF EXISTS _secfac_drift_repair;
CREATE PROCEDURE _secfac_drift_repair()
BEGIN
    -- 1. DROP FOREIGN KEYS CONDITIONALLY
    IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareCheck' AND CONSTRAINT_NAME = 'SecFacWelfareCheck_companyId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `SecFacWelfareCheck` DROP FOREIGN KEY `SecFacWelfareCheck_companyId_fkey`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareCheck' AND CONSTRAINT_NAME = 'SecFacWelfareCheck_deploymentId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `SecFacWelfareCheck` DROP FOREIGN KEY `SecFacWelfareCheck_deploymentId_fkey`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareCheck' AND CONSTRAINT_NAME = 'SecFacWelfareCheck_employeeId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `SecFacWelfareCheck` DROP FOREIGN KEY `SecFacWelfareCheck_employeeId_fkey`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareCheck' AND CONSTRAINT_NAME = 'SecFacWelfareCheck_projectId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `SecFacWelfareCheck` DROP FOREIGN KEY `SecFacWelfareCheck_projectId_fkey`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareCheck' AND CONSTRAINT_NAME = 'SecFacWelfareCheck_siteId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `SecFacWelfareCheck` DROP FOREIGN KEY `SecFacWelfareCheck_siteId_fkey`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareSetting' AND CONSTRAINT_NAME = 'SecFacWelfareSetting_companyId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `SecFacWelfareSetting` DROP FOREIGN KEY `SecFacWelfareSetting_companyId_fkey`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareSetting' AND CONSTRAINT_NAME = 'SecFacWelfareSetting_createdById_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `SecFacWelfareSetting` DROP FOREIGN KEY `SecFacWelfareSetting_createdById_fkey`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareSetting' AND CONSTRAINT_NAME = 'SecFacWelfareSetting_projectId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `SecFacWelfareSetting` DROP FOREIGN KEY `SecFacWelfareSetting_projectId_fkey`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareSetting' AND CONSTRAINT_NAME = 'SecFacWelfareSetting_siteId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `SecFacWelfareSetting` DROP FOREIGN KEY `SecFacWelfareSetting_siteId_fkey`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'SecfacPatrolExecutionCheckpoint' AND CONSTRAINT_NAME = 'SecfacPatrolExecutionCheckpoint_alertId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `SecfacPatrolExecutionCheckpoint` DROP FOREIGN KEY `SecfacPatrolExecutionCheckpoint_alertId_fkey`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'CostElementMaster' AND CONSTRAINT_NAME = 'CostElementMaster_versionId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `CostElementMaster` DROP FOREIGN KEY `CostElementMaster_versionId_fkey`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'CostFormulaDefinition' AND CONSTRAINT_NAME = 'CostFormulaDefinition_versionId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `CostFormulaDefinition` DROP FOREIGN KEY `CostFormulaDefinition_versionId_fkey`;
    END IF;

    -- 2. RENAME / DROP INDEXES CONDITIONALLY
    IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareSetting' AND INDEX_NAME = 'SecFacWelfareSetting_companyId_fkey') AND NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareSetting' AND INDEX_NAME = 'SecFacWelfareSetting_companyId_idx') THEN
        ALTER TABLE `SecFacWelfareSetting` RENAME INDEX `SecFacWelfareSetting_companyId_fkey` TO `SecFacWelfareSetting_companyId_idx`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareSetting' AND INDEX_NAME = 'SecFacWelfareSetting_siteId_fkey') AND NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareSetting' AND INDEX_NAME = 'SecFacWelfareSetting_siteId_idx') THEN
        ALTER TABLE `SecFacWelfareSetting` RENAME INDEX `SecFacWelfareSetting_siteId_fkey` TO `SecFacWelfareSetting_siteId_idx`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareCheck' AND INDEX_NAME = 'SecFacWelfareCheck_deploymentId_fkey') THEN
        ALTER TABLE `SecFacWelfareCheck` DROP INDEX `SecFacWelfareCheck_deploymentId_fkey`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareCheck' AND INDEX_NAME = 'SecFacWelfareCheck_projectId_fkey') THEN
        ALTER TABLE `SecFacWelfareCheck` DROP INDEX `SecFacWelfareCheck_projectId_fkey`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareSetting' AND INDEX_NAME = 'SecFacWelfareSetting_projectId_fkey') THEN
        ALTER TABLE `SecFacWelfareSetting` DROP INDEX `SecFacWelfareSetting_projectId_fkey`;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SecfacPatrolExecutionCheckpoint' AND INDEX_NAME = 'SecfacPatrolExecutionCheckpoint_alertId_fkey') THEN
        ALTER TABLE `SecfacPatrolExecutionCheckpoint` DROP INDEX `SecfacPatrolExecutionCheckpoint_alertId_fkey`;
    END IF;

    -- 3. CREATE NEW INDEXES CONDITIONALLY
    IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareSetting' AND INDEX_NAME = 'SecFacWelfareSetting_operationType_idx') THEN
        CREATE INDEX `SecFacWelfareSetting_operationType_idx` ON `SecFacWelfareSetting`(`operationType`);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareSetting' AND INDEX_NAME = 'SecFacWelfareSetting_isActive_idx') THEN
        CREATE INDEX `SecFacWelfareSetting_isActive_idx` ON `SecFacWelfareSetting`(`isActive`);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SecfacEvidenceAttachment' AND INDEX_NAME = 'SecfacEvidenceAttachment_integrityStatus_idx') THEN
        CREATE INDEX `SecfacEvidenceAttachment_integrityStatus_idx` ON `SecfacEvidenceAttachment`(`integrityStatus`);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SecfacPatrolExecution' AND INDEX_NAME = 'SecfacPatrolExecution_evaluationStatus_idx') THEN
        CREATE INDEX `SecfacPatrolExecution_evaluationStatus_idx` ON `SecfacPatrolExecution`(`evaluationStatus`);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SecfacPatrolExecutionCheckpoint' AND INDEX_NAME = 'SecfacPatrolExecutionCheckpoint_assuranceStatus_idx') THEN
        CREATE INDEX `SecfacPatrolExecutionCheckpoint_assuranceStatus_idx` ON `SecfacPatrolExecutionCheckpoint`(`assuranceStatus`);
    END IF;

    -- 4. ADD FOREIGN KEYS CONDITIONALLY
    IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareSetting' AND CONSTRAINT_NAME = 'SecFacWelfareSetting_createdById_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `SecFacWelfareSetting` ADD CONSTRAINT `SecFacWelfareSetting_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareCheck' AND CONSTRAINT_NAME = 'SecFacWelfareCheck_siteId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `SecFacWelfareCheck` ADD CONSTRAINT `SecFacWelfareCheck_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'SecFacWelfareCheck' AND CONSTRAINT_NAME = 'SecFacWelfareCheck_employeeId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `SecFacWelfareCheck` ADD CONSTRAINT `SecFacWelfareCheck_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'CostElementMaster' AND CONSTRAINT_NAME = 'CostElementMaster_versionId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `CostElementMaster` ADD CONSTRAINT `CostElementMaster_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `CostConfigurationVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'CostFormulaDefinition' AND CONSTRAINT_NAME = 'CostFormulaDefinition_versionId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        ALTER TABLE `CostFormulaDefinition` ADD CONSTRAINT `CostFormulaDefinition_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `CostConfigurationVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

END;

-- Execute state-aware drift repair procedure
CALL _secfac_drift_repair();
DROP PROCEDURE IF EXISTS _secfac_drift_repair;

-- Standard Column Alterations (Idempotent MODIFY statements)
ALTER TABLE `RosterSlotAssignment` MODIFY `assignedRosterType` VARCHAR(191) NULL DEFAULT 'PRIMARY';

ALTER TABLE `SecFacWelfareCheck`
    MODIFY `exemptionReason` TEXT NULL,
    MODIFY `settingSourceType` ENUM('POST', 'SITE', 'PROJECT', 'COMPANY', 'SYSTEM_DEFAULT') NOT NULL DEFAULT 'SYSTEM_DEFAULT';

ALTER TABLE `SecFacWelfareSetting`
    MODIFY `companyId` VARCHAR(191) NOT NULL,
    MODIFY `sourceType` ENUM('POST', 'SITE', 'PROJECT', 'COMPANY', 'SYSTEM_DEFAULT') NULL,
    MODIFY `createdById` VARCHAR(191) NOT NULL;

ALTER TABLE `SecfacEvidenceAttachment`
    MODIFY `hashAlgorithm` VARCHAR(191) NULL DEFAULT 'SHA-256',
    MODIFY `integrityStatus` ENUM('VERIFIED', 'MISMATCH', 'UNVERIFIED') NOT NULL DEFAULT 'UNVERIFIED';

ALTER TABLE `SecfacPatrolRoute` MODIFY `sequenceMode` VARCHAR(191) NOT NULL DEFAULT 'MANDATORY';

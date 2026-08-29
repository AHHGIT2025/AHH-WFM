-- CreateTable
CREATE TABLE `attendance_reconciliation_batches` (
    `id` VARCHAR(191) NOT NULL,
    `batchNumber` VARCHAR(191) NOT NULL,
    `importBatchId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `periodYear` INTEGER NOT NULL,
    `periodMonth` INTEGER NOT NULL,
    `periodFrom` DATE NULL,
    `periodTo` DATE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'NOT_STARTED',
    `reconciliationVersion` INTEGER NOT NULL DEFAULT 1,
    `currentApprovalVersion` INTEGER NOT NULL DEFAULT 0,
    `sourceEvidenceHash` VARCHAR(191) NULL,
    `systemEvidenceHash` VARCHAR(191) NULL,
    `totalCandidates` INTEGER NOT NULL DEFAULT 0,
    `matchedCandidates` INTEGER NOT NULL DEFAULT 0,
    `warningCandidates` INTEGER NOT NULL DEFAULT 0,
    `conflictCandidates` INTEGER NOT NULL DEFAULT 0,
    `blockingCandidates` INTEGER NOT NULL DEFAULT 0,
    `resolvedCandidates` INTEGER NOT NULL DEFAULT 0,
    `excludedCandidates` INTEGER NOT NULL DEFAULT 0,
    `reviewerId` VARCHAR(191) NULL,
    `reviewerName` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `submittedById` VARCHAR(191) NULL,
    `submittedByName` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NULL,
    `approverId` VARCHAR(191) NULL,
    `approverName` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `returnReason` TEXT NULL,
    `rejectionReason` TEXT NULL,
    `rowVersion` INTEGER NOT NULL DEFAULT 1,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `attendance_reconciliation_batches_batchNumber_key`(`batchNumber`),
    UNIQUE INDEX `attendance_reconciliation_batches_importBatchId_key`(`importBatchId`),
    INDEX `attendance_reconciliation_batches_company_op_status_idx`(`companyId`, `operationType`, `status`),
    INDEX `attendance_reconciliation_batches_import_batch_idx`(`importBatchId`),
    INDEX `attendance_reconciliation_batches_period_idx`(`periodYear`, `periodMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_reconciliation_candidates` (
    `id` VARCHAR(191) NOT NULL,
    `reconciliationBatchId` VARCHAR(191) NOT NULL,
    `operationalCandidateKey` VARCHAR(191) NOT NULL,
    `evidenceOrigin` VARCHAR(191) NOT NULL,
    `evidenceSubtype` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NULL,
    `dutyDate` DATE NULL,
    `siteId` VARCHAR(191) NULL,
    `contractId` VARCHAR(191) NULL,
    `shiftCode` VARCHAR(191) NULL,
    `rosterSlotAssignmentId` VARCHAR(191) NULL,
    `matchClassification` VARCHAR(191) NOT NULL,
    `conflictDetails` JSON NULL,
    `importedEvidence` JSON NULL,
    `systemEvidence` JSON NULL,
    `systemEvidenceFingerprint` VARCHAR(191) NULL,
    `currentDecisionId` VARCHAR(191) NULL,
    `isResolved` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `attendance_reconciliation_candidates_currentDecisionId_key`(`currentDecisionId`),
    UNIQUE INDEX `attendance_rec_candidates_batch_op_key_uniq`(`reconciliationBatchId`, `operationalCandidateKey`),
    INDEX `attendance_rec_candidates_batch_resolved_idx`(`reconciliationBatchId`, `isResolved`),
    INDEX `attendance_rec_candidates_emp_date_idx`(`employeeId`, `dutyDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_reconciliation_candidate_sources` (
    `id` VARCHAR(191) NOT NULL,
    `candidateId` VARCHAR(191) NOT NULL,
    `importRowId` VARCHAR(191) NOT NULL,
    `sourceRowNumber` INTEGER NOT NULL,
    `sourceSheetName` VARCHAR(191) NULL,
    `sourceCellProvenance` VARCHAR(191) NULL,
    `rawPayload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `attendance_rec_cand_sources_cand_row_uniq`(`candidateId`, `importRowId`),
    INDEX `attendance_rec_cand_sources_candidate_idx`(`candidateId`),
    INDEX `attendance_rec_cand_sources_import_row_idx`(`importRowId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_reconciliation_decisions` (
    `id` VARCHAR(191) NOT NULL,
    `reconciliationBatchId` VARCHAR(191) NOT NULL,
    `candidateId` VARCHAR(191) NOT NULL,
    `reconciliationVersion` INTEGER NOT NULL DEFAULT 1,
    `decisionVersion` INTEGER NOT NULL DEFAULT 1,
    `supersedesDecisionId` VARCHAR(191) NULL,
    `decisionType` VARCHAR(191) NOT NULL,
    `reasonCode` VARCHAR(191) NULL,
    `reasonNotes` TEXT NULL,
    `resolvedStatus` VARCHAR(191) NOT NULL,
    `resolvedTimeIn` DATETIME(3) NULL,
    `resolvedTimeOut` DATETIME(3) NULL,
    `resolvedWorkedMinutes` INTEGER NOT NULL DEFAULT 0,
    `resolvedOtMinutes` INTEGER NOT NULL DEFAULT 0,
    `resolvedLeaveType` VARCHAR(191) NULL,
    `resolvedAssignmentType` VARCHAR(191) NULL,
    `resolvedSiteId` VARCHAR(191) NULL,
    `resolvedRemarks` TEXT NULL,
    `decidedById` VARCHAR(191) NOT NULL,
    `decidedByName` VARCHAR(191) NOT NULL,
    `decidedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `attendance_rec_decisions_cand_ver_uniq`(`candidateId`, `reconciliationVersion`, `decisionVersion`),
    INDEX `attendance_rec_decisions_batch_ver_idx`(`reconciliationBatchId`, `reconciliationVersion`),
    INDEX `attendance_rec_decisions_candidate_idx`(`candidateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_reconciliation_events` (
    `id` VARCHAR(191) NOT NULL,
    `reconciliationBatchId` VARCHAR(191) NOT NULL,
    `reconciliationVersion` INTEGER NOT NULL DEFAULT 1,
    `actorId` VARCHAR(191) NOT NULL,
    `actorName` VARCHAR(191) NOT NULL,
    `actorRole` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `eventPayload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_reconciliation_events_batch_type_idx`(`reconciliationBatchId`, `eventType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_approved_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `reconciliationBatchId` VARCHAR(191) NOT NULL,
    `approvalVersion` INTEGER NOT NULL,
    `reconciliationVersion` INTEGER NOT NULL,
    `sourceImportBatchId` VARCHAR(191) NOT NULL,
    `sourceImportBatchNumber` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `periodFrom` DATE NULL,
    `periodTo` DATE NULL,
    `sourceEvidenceHash` VARCHAR(191) NOT NULL,
    `systemEvidenceHash` VARCHAR(191) NOT NULL,
    `snapshotHash` VARCHAR(191) NOT NULL,
    `totalRows` INTEGER NOT NULL,
    `approvedRegularMinutesTotal` INTEGER NOT NULL DEFAULT 0,
    `approvedOtMinutesTotal` INTEGER NOT NULL DEFAULT 0,
    `approvedById` VARCHAR(191) NOT NULL,
    `approvedByName` VARCHAR(191) NULL,
    `approvedByRole` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `attendance_approved_snapshots_batch_ver_uniq`(`reconciliationBatchId`, `approvalVersion`),
    INDEX `attendance_approved_snapshots_import_batch_idx`(`sourceImportBatchId`),
    INDEX `attendance_approved_snapshots_company_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_approved_snapshot_rows` (
    `id` VARCHAR(191) NOT NULL,
    `snapshotId` VARCHAR(191) NOT NULL,
    `reconciliationBatchId` VARCHAR(191) NOT NULL,
    `importBatchId` VARCHAR(191) NOT NULL,
    `importRowId` VARCHAR(191) NULL,
    `approvalVersion` INTEGER NOT NULL,
    `sourceRowNumber` INTEGER NULL,
    `operationalCandidateKey` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `employeeCode` VARCHAR(191) NOT NULL,
    `employeeName` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `siteName` VARCHAR(191) NULL,
    `contractId` VARCHAR(191) NULL,
    `contractNumber` VARCHAR(191) NULL,
    `rosterSlotAssignmentId` VARCHAR(191) NULL,
    `shiftCode` VARCHAR(191) NULL,
    `dutyDate` DATE NOT NULL,
    `plannedStart` VARCHAR(191) NULL,
    `plannedEnd` VARCHAR(191) NULL,
    `actualTimeIn` DATETIME(3) NULL,
    `actualTimeOut` DATETIME(3) NULL,
    `approvedStatus` VARCHAR(191) NOT NULL,
    `approvedRegularMinutes` INTEGER NOT NULL DEFAULT 0,
    `approvedOtMinutes` INTEGER NOT NULL DEFAULT 0,
    `approvedLeaveType` VARCHAR(191) NULL,
    `approvedAssignmentType` VARCHAR(191) NULL,
    `reconciliationDecisionId` VARCHAR(191) NOT NULL,
    `decisionType` VARCHAR(191) NOT NULL,
    `reasonCode` VARCHAR(191) NULL,
    `reasonNotes` TEXT NULL,
    `rowChecksum` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `attendance_approved_snapshot_rows_snap_opkey_uniq`(`snapshotId`, `operationalCandidateKey`),
    INDEX `attendance_approved_snapshot_rows_snap_row_idx`(`snapshotId`, `sourceRowNumber`),
    INDEX `attendance_approved_snapshot_rows_emp_date_idx`(`employeeId`, `dutyDate`),
    INDEX `attendance_approved_snapshot_rows_batch_ver_idx`(`reconciliationBatchId`, `approvalVersion`),
    INDEX `attendance_approved_snapshot_rows_decision_idx`(`reconciliationDecisionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attendance_reconciliation_batches` ADD CONSTRAINT `attendance_reconciliation_batches_importBatchId_fkey` FOREIGN KEY (`importBatchId`) REFERENCES `attendance_import_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_reconciliation_batches` ADD CONSTRAINT `attendance_reconciliation_batches_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_reconciliation_candidates` ADD CONSTRAINT `attendance_reconciliation_candidates_reconciliationBatchId_fkey` FOREIGN KEY (`reconciliationBatchId`) REFERENCES `attendance_reconciliation_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_reconciliation_candidates` ADD CONSTRAINT `attendance_reconciliation_candidates_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_reconciliation_candidates` ADD CONSTRAINT `attendance_reconciliation_candidates_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_reconciliation_candidates` ADD CONSTRAINT `attendance_reconciliation_candidates_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `ManpowerContract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_reconciliation_candidates` ADD CONSTRAINT `attendance_reconciliation_candidates_currentDecisionId_fkey` FOREIGN KEY (`currentDecisionId`) REFERENCES `attendance_reconciliation_decisions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_reconciliation_candidate_sources` ADD CONSTRAINT `attendance_reconciliation_candidate_sources_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `attendance_reconciliation_candidates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_reconciliation_candidate_sources` ADD CONSTRAINT `attendance_reconciliation_candidate_sources_importRowId_fkey` FOREIGN KEY (`importRowId`) REFERENCES `attendance_import_rows`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_reconciliation_decisions` ADD CONSTRAINT `attendance_reconciliation_decisions_reconciliationBatchId_fkey` FOREIGN KEY (`reconciliationBatchId`) REFERENCES `attendance_reconciliation_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_reconciliation_decisions` ADD CONSTRAINT `attendance_reconciliation_decisions_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `attendance_reconciliation_candidates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_reconciliation_decisions` ADD CONSTRAINT `attendance_reconciliation_decisions_supersedesDecisionId_fkey` FOREIGN KEY (`supersedesDecisionId`) REFERENCES `attendance_reconciliation_decisions`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `attendance_reconciliation_events` ADD CONSTRAINT `attendance_reconciliation_events_reconciliationBatchId_fkey` FOREIGN KEY (`reconciliationBatchId`) REFERENCES `attendance_reconciliation_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_approved_snapshots` ADD CONSTRAINT `attendance_approved_snapshots_reconciliationBatchId_fkey` FOREIGN KEY (`reconciliationBatchId`) REFERENCES `attendance_reconciliation_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_approved_snapshots` ADD CONSTRAINT `attendance_approved_snapshots_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_approved_snapshot_rows` ADD CONSTRAINT `attendance_approved_snapshot_rows_snapshotId_fkey` FOREIGN KEY (`snapshotId`) REFERENCES `attendance_approved_snapshots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_approved_snapshot_rows` ADD CONSTRAINT `attendance_approved_snapshot_rows_importRowId_fkey` FOREIGN KEY (`importRowId`) REFERENCES `attendance_import_rows`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_approved_snapshot_rows` ADD CONSTRAINT `attendance_approved_snapshot_rows_reconciliationDecisionId_fkey` FOREIGN KEY (`reconciliationDecisionId`) REFERENCES `attendance_reconciliation_decisions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `SecFacOperationalAlert`
  ADD COLUMN `reviewStatus` VARCHAR(191) NULL,
  ADD COLUMN `reviewedAt` DATETIME(3) NULL,
  ADD COLUMN `reviewedById` VARCHAR(191) NULL,
  ADD COLUMN `reviewComment` TEXT NULL;

-- CreateIndex
CREATE INDEX `sf_oa_op_review_idx` ON `SecFacOperationalAlert`(`operationType`, `reviewStatus`);

-- CreateTable
CREATE TABLE `SecFacMonitoringSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `snapshotType` VARCHAR(191) NOT NULL,
    `workerName` VARCHAR(191) NULL,
    `healthStatus` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL,
    `queueDepth` INTEGER NOT NULL DEFAULT 0,
    `oldestPendingAgeSeconds` INTEGER NOT NULL DEFAULT 0,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `deadLetterCount` INTEGER NOT NULL DEFAULT 0,
    `expiredClaimCount` INTEGER NOT NULL DEFAULT 0,
    `staleLockCount` INTEGER NOT NULL DEFAULT 0,
    `processedCount` INTEGER NOT NULL DEFAULT 0,
    `failureCount` INTEGER NOT NULL DEFAULT 0,
    `heartbeatAgeSeconds` INTEGER NOT NULL DEFAULT 0,
    `detailsJson` JSON NULL,
    `capturedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndexes
CREATE INDEX `sf_ms_op_type_cap_idx` ON `SecFacMonitoringSnapshot`(`operationType`, `snapshotType`, `capturedAt`);
CREATE INDEX `sf_ms_status_cap_idx` ON `SecFacMonitoringSnapshot`(`healthStatus`, `capturedAt`);
CREATE INDEX `sf_ms_sev_cap_idx` ON `SecFacMonitoringSnapshot`(`severity`, `capturedAt`);

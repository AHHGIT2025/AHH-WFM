-- AlterTable
ALTER TABLE `SecFacAlertNotification` ADD COLUMN `claimToken` VARCHAR(191) NULL,
    ADD COLUMN `claimedAt` DATETIME(3) NULL,
    ADD COLUMN `claimedBy` VARCHAR(191) NULL,
    ADD COLUMN `claimExpiresAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `SecFacAlertNotification_claimExpiresAt_status_idx` ON `SecFacAlertNotification`(`claimExpiresAt`, `status`);

-- CreateTable
CREATE TABLE `SecFacNotificationPreference` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `roleCode` VARCHAR(191) NULL,
    `alertCode` VARCHAR(191) NULL,
    `inAppEnabled` BOOLEAN NOT NULL DEFAULT true,
    `emailEnabled` BOOLEAN NOT NULL DEFAULT false,
    `pushEnabled` BOOLEAN NOT NULL DEFAULT false,
    `smsEnabled` BOOLEAN NOT NULL DEFAULT false,
    `whatsappEnabled` BOOLEAN NOT NULL DEFAULT false,
    `quietHoursEnabled` BOOLEAN NOT NULL DEFAULT false,
    `quietHoursStart` VARCHAR(191) NULL,
    `quietHoursEnd` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Qatar',
    `minimumSeverity` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `allowCriticalOverride` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `settings` JSON NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecFacNotificationPreference_operationType_userId_isActive_idx`(`operationType`, `userId`, `isActive`),
    INDEX `SecFacNotificationPreference_operationType_roleCode_isActive_idx`(`operationType`, `roleCode`, `isActive`),
    INDEX `SecFacNotificationPreference_operationType_alertCode_isActive_idx`(`operationType`, `alertCode`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecFacNotificationAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `notificationId` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NULL,
    `providerMessageId` VARCHAR(191) NULL,
    `attemptNumber` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `attemptedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `responseCode` VARCHAR(191) NULL,
    `responseMessage` VARCHAR(191) NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `retryable` BOOLEAN NOT NULL DEFAULT false,
    `nextRetryAt` DATETIME(3) NULL,
    `requestMetadata` JSON NULL,
    `responseMetadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SecFacNotificationAttempt_notificationId_attemptNumber_idx`(`notificationId`, `attemptNumber`),
    INDEX `SecFacNotificationAttempt_operationType_status_idx`(`operationType`, `status`),
    INDEX `SecFacNotificationAttempt_nextRetryAt_retryable_idx`(`nextRetryAt`, `retryable`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecFacWorkerJob` (
    `id` VARCHAR(191) NOT NULL,
    `jobType` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `lockKey` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `heartbeatAt` DATETIME(3) NULL,
    `processedCount` INTEGER NOT NULL DEFAULT 0,
    `successCount` INTEGER NOT NULL DEFAULT 0,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `failureCount` INTEGER NOT NULL DEFAULT 0,
    `skippedCount` INTEGER NOT NULL DEFAULT 0,
    `errorSummary` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SecFacWorkerJob_jobType_status_startedAt_idx`(`jobType`, `status`, `startedAt`),
    INDEX `SecFacWorkerJob_operationType_startedAt_idx`(`operationType`, `startedAt`),
    INDEX `SecFacWorkerJob_lockKey_status_idx`(`lockKey`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecFacWorkerLock` (
    `id` VARCHAR(191) NOT NULL,
    `lockKey` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `acquiredAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `heartbeatAt` DATETIME(3) NULL,
    `metadata` JSON NULL,

    UNIQUE INDEX `SecFacWorkerLock_lockKey_key`(`lockKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecFacChannelConfiguration` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT false,
    `senderName` VARCHAR(191) NULL,
    `senderAddress` VARCHAR(191) NULL,
    `templateNamespace` VARCHAR(191) NULL,
    `maximumAttempts` INTEGER NOT NULL DEFAULT 3,
    `baseRetryDelaySeconds` INTEGER NOT NULL DEFAULT 60,
    `maximumRetryDelaySeconds` INTEGER NOT NULL DEFAULT 3600,
    `rateLimitPerMinute` INTEGER NULL,
    `settings` JSON NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecFacChannelConfiguration_operationType_channel_key`(`operationType`, `channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SecFacNotificationAttempt` ADD CONSTRAINT `SecFacNotificationAttempt_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `SecFacAlertNotification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

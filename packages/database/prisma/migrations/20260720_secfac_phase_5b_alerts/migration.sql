-- CreateTable
CREATE TABLE `SecFacAlertRule` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `triggerAfterMinutes` INTEGER NULL,
    `reminderIntervalMinutes` INTEGER NULL,
    `maximumReminders` INTEGER NOT NULL DEFAULT 0,
    `targetRole` VARCHAR(191) NULL,
    `fallbackRole` VARCHAR(191) NULL,
    `contractId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `escalationConfig` JSON NULL,
    `conditions` JSON NULL,
    `settings` JSON NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecFacAlertRule_operationType_code_isActive_idx`(`operationType`, `code`, `isActive`),
    INDEX `SecFacAlertRule_siteId_idx`(`siteId`),
    INDEX `SecFacAlertRule_projectId_idx`(`projectId`),
    INDEX `SecFacAlertRule_contractId_idx`(`contractId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecFacOperationalAlert` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `ruleId` VARCHAR(191) NULL,
    `alertCode` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NULL,
    `sourceReference` VARCHAR(191) NULL,
    `contractId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NULL,
    `assignmentId` VARCHAR(191) NULL,
    `patrolId` VARCHAR(191) NULL,
    `checklistId` VARCHAR(191) NULL,
    `incidentId` VARCHAR(191) NULL,
    `severity` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `businessDate` DATETIME(3) NOT NULL,
    `deduplicationKey` VARCHAR(191) NOT NULL,
    `assignedUserId` VARCHAR(191) NULL,
    `assignedRole` VARCHAR(191) NULL,
    `assignmentSource` VARCHAR(191) NULL,
    `escalationLevel` INTEGER NOT NULL DEFAULT 0,
    `firstDetectedAt` DATETIME(3) NOT NULL,
    `lastDetectedAt` DATETIME(3) NOT NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `acknowledgedById` VARCHAR(191) NULL,
    `actionStartedAt` DATETIME(3) NULL,
    `actionStartedById` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `resolvedById` VARCHAR(191) NULL,
    `resolutionNote` TEXT NULL,
    `dismissedAt` DATETIME(3) NULL,
    `dismissedById` VARCHAR(191) NULL,
    `dismissalReason` TEXT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` VARCHAR(191) NULL,
    `cancellationReason` TEXT NULL,
    `nextReminderAt` DATETIME(3) NULL,
    `escalatedAt` DATETIME(3) NULL,
    `reminderCount` INTEGER NOT NULL DEFAULT 0,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecFacOperationalAlert_operationType_status_severity_idx`(`operationType`, `status`, `severity`),
    INDEX `SecFacOperationalAlert_assignedUserId_status_idx`(`assignedUserId`, `status`),
    INDEX `SecFacOperationalAlert_siteId_status_idx`(`siteId`, `status`),
    INDEX `SecFacOperationalAlert_projectId_status_idx`(`projectId`, `status`),
    INDEX `SecFacOperationalAlert_businessDate_idx`(`businessDate`),
    INDEX `SecFacOperationalAlert_nextReminderAt_status_idx`(`nextReminderAt`, `status`),
    UNIQUE INDEX `SecFacOperationalAlert_operationType_deduplicationKey_key`(`operationType`, `deduplicationKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecFacAlertEvent` (
    `id` VARCHAR(191) NOT NULL,
    `alertId` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `previousStatus` VARCHAR(191) NULL,
    `newStatus` VARCHAR(191) NULL,
    `previousAssignedUserId` VARCHAR(191) NULL,
    `newAssignedUserId` VARCHAR(191) NULL,
    `escalationLevel` INTEGER NULL,
    `performedById` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SecFacAlertEvent_alertId_createdAt_idx`(`alertId`, `createdAt`),
    INDEX `SecFacAlertEvent_operationType_eventType_idx`(`operationType`, `eventType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecFacAlertNotification` (
    `id` VARCHAR(191) NOT NULL,
    `alertId` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `recipientUserId` VARCHAR(191) NULL,
    `recipientRole` VARCHAR(191) NULL,
    `channel` VARCHAR(191) NOT NULL DEFAULT 'IN_APP',
    `notificationType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `notificationKey` VARCHAR(191) NOT NULL,
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `scheduledAt` DATETIME(3) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `failureReason` TEXT NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecFacAlertNotification_notificationKey_key`(`notificationKey`),
    INDEX `SecFacAlertNotification_status_scheduledAt_idx`(`status`, `scheduledAt`),
    INDEX `SecFacAlertNotification_recipientUserId_status_idx`(`recipientUserId`, `status`),
    INDEX `SecFacAlertNotification_alertId_idx`(`alertId`),
    INDEX `SecFacAlertNotification_operationType_status_idx`(`operationType`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SecFacOperationalAlert` ADD CONSTRAINT `SecFacOperationalAlert_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `SecFacAlertRule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecFacAlertEvent` ADD CONSTRAINT `SecFacAlertEvent_alertId_fkey` FOREIGN KEY (`alertId`) REFERENCES `SecFacOperationalAlert`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecFacAlertNotification` ADD CONSTRAINT `SecFacAlertNotification_alertId_fkey` FOREIGN KEY (`alertId`) REFERENCES `SecFacOperationalAlert`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


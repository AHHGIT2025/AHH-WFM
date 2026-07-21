-- CreateTable
CREATE TABLE `SecFacDispatchAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `contractId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NULL,
    `deploymentId` VARCHAR(191) NULL,
    `shiftAssignmentId` VARCHAR(191) NULL,
    `alertId` VARCHAR(191) NOT NULL,
    `responderId` VARCHAR(191) NOT NULL,
    `dispatchedById` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
    `attemptNumber` INTEGER NOT NULL DEFAULT 1,
    `assignmentSequence` INTEGER NOT NULL DEFAULT 1,
    `previousAssignmentId` VARCHAR(191) NULL,
    `acceptanceDeadline` DATETIME(3) NULL,
    `dispatchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acceptedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `timedOutAt` DATETIME(3) NULL,
    `arrivedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `rejectionCategory` VARCHAR(191) NULL,
    `rejectionReason` TEXT NULL,
    `reassignmentReason` TEXT NULL,
    `cancellationCategory` VARCHAR(191) NULL,
    `cancellationReason` TEXT NULL,
    `arrivalLatitude` DOUBLE NULL,
    `arrivalLongitude` DOUBLE NULL,
    `arrivalAccuracyMeters` DOUBLE NULL,
    `completionNotes` TEXT NULL,
    `responderEligibilitySnapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecFacDispatchAssignment_operationType_idx`(`operationType`),
    INDEX `SecFacDispatchAssignment_companyId_idx`(`companyId`),
    INDEX `SecFacDispatchAssignment_siteId_idx`(`siteId`),
    INDEX `SecFacDispatchAssignment_alertId_idx`(`alertId`),
    INDEX `SecFacDispatchAssignment_responderId_idx`(`responderId`),
    INDEX `SecFacDispatchAssignment_dispatchedById_idx`(`dispatchedById`),
    INDEX `SecFacDispatchAssignment_status_idx`(`status`),
    INDEX `SecFacDispatchAssignment_acceptanceDeadline_idx`(`acceptanceDeadline`),
    INDEX `SecFacDispatchAssignment_dispatchedAt_idx`(`dispatchedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SecFacDispatchAssignment` ADD CONSTRAINT `SecFacDispatchAssignment_alertId_fkey` FOREIGN KEY (`alertId`) REFERENCES `SecFacOperationalAlert`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecFacDispatchAssignment` ADD CONSTRAINT `SecFacDispatchAssignment_responderId_fkey` FOREIGN KEY (`responderId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SecFacDispatchAssignment` ADD CONSTRAINT `SecFacDispatchAssignment_dispatchedById_fkey` FOREIGN KEY (`dispatchedById`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

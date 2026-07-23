-- AlterTable
ALTER TABLE `RosterPlanningException` ADD COLUMN `activeExceptionKey` VARCHAR(191) NULL,
    ADD COLUMN `businessDate` DATE NULL,
    ADD COLUMN `cancellationReason` TEXT NULL,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `cancelledById` VARCHAR(191) NULL,
    ADD COLUMN `employeeId` VARCHAR(191) NULL,
    ADD COLUMN `leaveRequestId` VARCHAR(191) NULL,
    ADD COLUMN `primaryAssignmentId` VARCHAR(191) NULL,
    ADD COLUMN `slotId` VARCHAR(191) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE `RosterSlotAssignment` 
    ADD COLUMN `activeCoverageKey` VARCHAR(191) NULL,
    ADD COLUMN `planningExceptionId` VARCHAR(191) NULL,
    ADD COLUMN `replacesAssignmentId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `RosterPlanningException_activeExceptionKey_key` ON `RosterPlanningException`(`activeExceptionKey`);

CREATE INDEX `RosterPlanningException_slotId_idx` ON `RosterPlanningException`(`slotId`);

CREATE INDEX `RosterPlanningException_employeeId_idx` ON `RosterPlanningException`(`employeeId`);

CREATE INDEX `RosterPlanningException_leaveRequestId_idx` ON `RosterPlanningException`(`leaveRequestId`);

CREATE INDEX `RosterPlanningException_primaryAssignmentId_idx` ON `RosterPlanningException`(`primaryAssignmentId`);

CREATE UNIQUE INDEX `RosterSlotAssignment_activeCoverageKey_key` ON `RosterSlotAssignment`(`activeCoverageKey`);

-- AddForeignKey
ALTER TABLE `RosterSlotAssignment` ADD CONSTRAINT `RosterSlotAssignment_replacesAssignmentId_fkey` FOREIGN KEY (`replacesAssignmentId`) REFERENCES `RosterSlotAssignment`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `RosterSlotAssignment` ADD CONSTRAINT `RosterSlotAssignment_planningExceptionId_fkey` FOREIGN KEY (`planningExceptionId`) REFERENCES `RosterPlanningException`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `RosterPlanningException` ADD CONSTRAINT `RosterPlanningException_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterPlanningException` ADD CONSTRAINT `RosterPlanningException_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterPlanningException` ADD CONSTRAINT `RosterPlanningException_slotId_fkey` FOREIGN KEY (`slotId`) REFERENCES `RosterRequirementSlot`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `RosterPlanningException` ADD CONSTRAINT `RosterPlanningException_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `RosterPlanningException` ADD CONSTRAINT `RosterPlanningException_leaveRequestId_fkey` FOREIGN KEY (`leaveRequestId`) REFERENCES `LeaveRequest`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `RosterPlanningException` ADD CONSTRAINT `RosterPlanningException_primaryAssignmentId_fkey` FOREIGN KEY (`primaryAssignmentId`) REFERENCES `RosterSlotAssignment`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

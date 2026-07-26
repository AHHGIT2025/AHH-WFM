-- Migration: 20260726_roster_assignment_bulk_linkage
-- Add bulk operation action type to ManpowerBulkOperationLog and linkage fields to RosterSlotAssignment

-- 1. Add actionType to ManpowerBulkOperationLog
ALTER TABLE `ManpowerBulkOperationLog` 
ADD COLUMN `actionType` VARCHAR(191) NOT NULL DEFAULT 'DEPLOYMENT';

-- 2. Add index for actionType on ManpowerBulkOperationLog
CREATE INDEX `ManpowerBulkOperationLog_actionType_idx` ON `ManpowerBulkOperationLog`(`actionType`);

-- 3. Add bulkOperationId and assignmentGroupKey to RosterSlotAssignment
ALTER TABLE `RosterSlotAssignment` 
ADD COLUMN `bulkOperationId` VARCHAR(191) NULL,
ADD COLUMN `assignmentGroupKey` VARCHAR(191) NULL;

-- 4. Add Indexes to RosterSlotAssignment
CREATE INDEX `RosterSlotAssignment_bulkOperationId_idx` ON `RosterSlotAssignment`(`bulkOperationId`);
CREATE INDEX `RosterSlotAssignment_assignmentGroupKey_idx` ON `RosterSlotAssignment`(`assignmentGroupKey`);
CREATE INDEX `RosterSlotAssignment_bulkOperationId_assignmentGroupKey_idx` ON `RosterSlotAssignment`(`bulkOperationId`, `assignmentGroupKey`);
CREATE INDEX `RosterSlotAssignment_employeeId_assignmentGroupKey_idx` ON `RosterSlotAssignment`(`employeeId`, `assignmentGroupKey`);

-- 5. Add Foreign Key Constraint
ALTER TABLE `RosterSlotAssignment` 
ADD CONSTRAINT `RosterSlotAssignment_bulkOperationId_fkey` 
FOREIGN KEY (`bulkOperationId`) REFERENCES `ManpowerBulkOperationLog`(`id`) 
ON DELETE SET NULL ON UPDATE CASCADE;

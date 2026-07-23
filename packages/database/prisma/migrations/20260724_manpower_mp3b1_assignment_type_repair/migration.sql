-- AlterTable RosterSlotAssignment
ALTER TABLE `RosterSlotAssignment`
    ADD COLUMN `assignmentType` VARCHAR(191) NOT NULL DEFAULT 'PRIMARY';

-- Backfill assignmentType from assignedRosterType if populated
UPDATE `RosterSlotAssignment`
SET `assignmentType` = `assignedRosterType`
WHERE `assignedRosterType` IS NOT NULL AND `assignedRosterType` != '';

-- Backfill RELIEVER assignmentType based on authoritative relational fields
UPDATE `RosterSlotAssignment`
SET `assignmentType` = 'RELIEVER'
WHERE `planningExceptionId` IS NOT NULL
   OR `replacesAssignmentId` IS NOT NULL
   OR `activeCoverageKey` IS NOT NULL;

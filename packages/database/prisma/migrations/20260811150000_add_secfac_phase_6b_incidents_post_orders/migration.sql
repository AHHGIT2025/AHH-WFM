-- CreateTable
CREATE TABLE `SecfacPostOrder` (
    `id` VARCHAR(191) NOT NULL,
    `familyId` VARCHAR(191) NOT NULL,
    `postOrderCode` VARCHAR(191) NULL,
    `operationType` VARCHAR(191) NOT NULL DEFAULT 'SECURITY_GUARDING',
    `companyId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `checkpointId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'GENERAL_POST_ORDER',
    `content` TEXT NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `effectiveTo` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `requiresAcknowledgement` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NOT NULL,
    `publishedById` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecfacPostOrder_operationType_idx`(`operationType`),
    INDEX `SecfacPostOrder_companyId_idx`(`companyId`),
    INDEX `SecfacPostOrder_siteId_idx`(`siteId`),
    INDEX `SecfacPostOrder_checkpointId_idx`(`checkpointId`),
    INDEX `SecfacPostOrder_familyId_idx`(`familyId`),
    INDEX `SecfacPostOrder_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacPostOrderAcknowledgement` (
    `id` VARCHAR(191) NOT NULL,
    `postOrderId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `deploymentId` VARCHAR(191) NULL,
    `acknowledgedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acknowledgementMethod` VARCHAR(191) NOT NULL DEFAULT 'MOBILE_APP',
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SecfacPostOrderAcknowledgement_idempotencyKey_key`(`idempotencyKey`),
    INDEX `SecfacPostOrderAcknowledgement_postOrderId_idx`(`postOrderId`),
    INDEX `SecfacPostOrderAcknowledgement_employeeId_idx`(`employeeId`),
    UNIQUE INDEX `SecfacPostOrderAcknowledgement_postOrderId_employeeId_key`(`postOrderId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacShiftBriefing` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL DEFAULT 'SECURITY_GUARDING',
    `companyId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NULL,
    `briefingDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `supervisorId` VARCHAR(191) NOT NULL,
    `stage` VARCHAR(191) NOT NULL DEFAULT 'BRIEFING_DRAFT',
    `postAssignments` JSON NULL,
    `safetyNotes` TEXT NULL,
    `knownRisks` TEXT NULL,
    `temporaryInstructions` TEXT NULL,
    `briefingNotes` TEXT NULL,
    `briefingCompletedAt` DATETIME(3) NULL,
    `debriefingNotes` TEXT NULL,
    `debriefingCompletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SecfacShiftBriefing_operationType_idx`(`operationType`),
    INDEX `SecfacShiftBriefing_companyId_idx`(`companyId`),
    INDEX `SecfacShiftBriefing_siteId_idx`(`siteId`),
    INDEX `SecfacShiftBriefing_supervisorId_idx`(`supervisorId`),
    INDEX `SecfacShiftBriefing_briefingDate_idx`(`briefingDate`),
    INDEX `SecfacShiftBriefing_stage_idx`(`stage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacShiftBriefingParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `briefingId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `deploymentId` VARCHAR(191) NULL,
    `attendanceStatus` VARCHAR(191) NOT NULL DEFAULT 'PRESENT',
    `acknowledgedAt` DATETIME(3) NULL,
    `recordedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SecfacShiftBriefingParticipant_briefingId_idx`(`briefingId`),
    INDEX `SecfacShiftBriefingParticipant_employeeId_idx`(`employeeId`),
    UNIQUE INDEX `SecfacShiftBriefingParticipant_briefingId_employeeId_key`(`briefingId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacShiftBriefingCarriedIncident` (
    `id` VARCHAR(191) NOT NULL,
    `briefingId` VARCHAR(191) NOT NULL,
    `incidentId` VARCHAR(191) NOT NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SecfacShiftBriefingCarriedIncident_briefingId_idx`(`briefingId`),
    INDEX `SecfacShiftBriefingCarriedIncident_incidentId_idx`(`incidentId`),
    UNIQUE INDEX `SecfacShiftBriefingCarriedIncident_briefingId_incidentId_key`(`briefingId`, `incidentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacIncident` (
    `id` VARCHAR(191) NOT NULL,
    `incidentNumber` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL DEFAULT 'SECURITY_GUARDING',
    `companyId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `checkpointId` VARCHAR(191) NULL,
    `reportedById` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'MOBILE_APP',
    `type` VARCHAR(191) NOT NULL DEFAULT 'INCIDENT',
    `category` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
    `severity` VARCHAR(191) NOT NULL DEFAULT 'MINOR',
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `immediateAction` TEXT NULL,
    `incidentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignedToId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'REPORTED',
    `closureReason` TEXT NULL,
    `closedById` VARCHAR(191) NULL,
    `closedAt` DATETIME(3) NULL,
    `workflowInstanceId` VARCHAR(191) NULL,
    `workflowStatus` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `sosAlertId` VARCHAR(191) NULL,
    `dispatchAssignmentId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecfacIncident_idempotencyKey_key`(`idempotencyKey`),
    INDEX `SecfacIncident_operationType_idx`(`operationType`),
    INDEX `SecfacIncident_companyId_idx`(`companyId`),
    INDEX `SecfacIncident_siteId_idx`(`siteId`),
    INDEX `SecfacIncident_checkpointId_idx`(`checkpointId`),
    INDEX `SecfacIncident_reportedById_idx`(`reportedById`),
    INDEX `SecfacIncident_assignedToId_idx`(`assignedToId`),
    INDEX `SecfacIncident_status_idx`(`status`),
    INDEX `SecfacIncident_type_idx`(`type`),
    INDEX `SecfacIncident_severity_idx`(`severity`),
    INDEX `SecfacIncident_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `SecfacIncident_companyId_incidentNumber_key`(`companyId`, `incidentNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacIncidentHistory` (
    `id` VARCHAR(191) NOT NULL,
    `incidentId` VARCHAR(191) NOT NULL,
    `fromStatus` VARCHAR(191) NULL,
    `toStatus` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `remarks` TEXT NULL,
    `performedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SecfacIncidentHistory_incidentId_idx`(`incidentId`),
    INDEX `SecfacIncidentHistory_toStatus_idx`(`toStatus`),
    INDEX `SecfacIncidentHistory_performedById_idx`(`performedById`),
    INDEX `SecfacIncidentHistory_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecfacSupervisorInspection` (
    `id` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL DEFAULT 'SECURITY_GUARDING',
    `companyId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `checkpointId` VARCHAR(191) NULL,
    `supervisorId` VARCHAR(191) NOT NULL,
    `inspectedEmployeeId` VARCHAR(191) NOT NULL,
    `inspectionDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `checklistExecutionId` VARCHAR(191) NOT NULL,
    `overallResult` VARCHAR(191) NOT NULL DEFAULT 'COMPLIANT',
    `notes` TEXT NULL,
    `correctiveAction` TEXT NULL,
    `followUpRequired` BOOLEAN NOT NULL DEFAULT false,
    `followUpDueDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'COMPLETED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SecfacSupervisorInspection_checklistExecutionId_key`(`checklistExecutionId`),
    INDEX `SecfacSupervisorInspection_operationType_idx`(`operationType`),
    INDEX `SecfacSupervisorInspection_companyId_idx`(`companyId`),
    INDEX `SecfacSupervisorInspection_siteId_idx`(`siteId`),
    INDEX `SecfacSupervisorInspection_supervisorId_idx`(`supervisorId`),
    INDEX `SecfacSupervisorInspection_inspectedEmployeeId_idx`(`inspectedEmployeeId`),
    INDEX `SecfacSupervisorInspection_overallResult_idx`(`overallResult`),
    INDEX `SecfacSupervisorInspection_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `SecfacEvidenceAttachment`
    MODIFY `executionId` VARCHAR(191) NULL,
    ADD COLUMN `incidentId` VARCHAR(191) NULL,
    ADD COLUMN `postOrderId` VARCHAR(191) NULL,
    ADD INDEX `SecfacEvidenceAttachment_incidentId_idx`(`incidentId`),
    ADD INDEX `SecfacEvidenceAttachment_postOrderId_idx`(`postOrderId`);

-- AlterTable
ALTER TABLE `SecfacFieldExecutionAudit`
    ADD COLUMN `incidentId` VARCHAR(191) NULL,
    ADD COLUMN `postOrderId` VARCHAR(191) NULL,
    ADD COLUMN `inspectionId` VARCHAR(191) NULL,
    ADD INDEX `SecfacFieldExecutionAudit_incidentId_idx`(`incidentId`),
    ADD INDEX `SecfacFieldExecutionAudit_postOrderId_idx`(`postOrderId`),
    ADD INDEX `SecfacFieldExecutionAudit_inspectionId_idx`(`inspectionId`);

-- AddForeignKeys
ALTER TABLE `SecfacPostOrder` ADD CONSTRAINT `SecfacPostOrder_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SecfacPostOrder` ADD CONSTRAINT `SecfacPostOrder_checkpointId_fkey` FOREIGN KEY (`checkpointId`) REFERENCES `SecfacCheckpoint`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SecfacPostOrder` ADD CONSTRAINT `SecfacPostOrder_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SecfacPostOrder` ADD CONSTRAINT `SecfacPostOrder_publishedById_fkey` FOREIGN KEY (`publishedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SecfacPostOrderAcknowledgement` ADD CONSTRAINT `SecfacPostOrderAcknowledgement_postOrderId_fkey` FOREIGN KEY (`postOrderId`) REFERENCES `SecfacPostOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SecfacPostOrderAcknowledgement` ADD CONSTRAINT `SecfacPostOrderAcknowledgement_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SecfacShiftBriefing` ADD CONSTRAINT `SecfacShiftBriefing_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SecfacShiftBriefing` ADD CONSTRAINT `SecfacShiftBriefing_supervisorId_fkey` FOREIGN KEY (`supervisorId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SecfacShiftBriefingParticipant` ADD CONSTRAINT `SecfacShiftBriefingParticipant_briefingId_fkey` FOREIGN KEY (`briefingId`) REFERENCES `SecfacShiftBriefing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SecfacShiftBriefingParticipant` ADD CONSTRAINT `SecfacShiftBriefingParticipant_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SecfacShiftBriefingParticipant` ADD CONSTRAINT `SecfacShiftBriefingParticipant_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SecfacShiftBriefingCarriedIncident` ADD CONSTRAINT `SecfacShiftBriefingCarriedIncident_briefingId_fkey` FOREIGN KEY (`briefingId`) REFERENCES `SecfacShiftBriefing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SecfacShiftBriefingCarriedIncident` ADD CONSTRAINT `SecfacShiftBriefingCarriedIncident_incidentId_fkey` FOREIGN KEY (`incidentId`) REFERENCES `SecfacIncident`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SecfacIncident` ADD CONSTRAINT `SecfacIncident_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SecfacIncident` ADD CONSTRAINT `SecfacIncident_checkpointId_fkey` FOREIGN KEY (`checkpointId`) REFERENCES `SecfacCheckpoint`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SecfacIncident` ADD CONSTRAINT `SecfacIncident_reportedById_fkey` FOREIGN KEY (`reportedById`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SecfacIncident` ADD CONSTRAINT `SecfacIncident_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SecfacIncident` ADD CONSTRAINT `SecfacIncident_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SecfacIncidentHistory` ADD CONSTRAINT `SecfacIncidentHistory_incidentId_fkey` FOREIGN KEY (`incidentId`) REFERENCES `SecfacIncident`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SecfacIncidentHistory` ADD CONSTRAINT `SecfacIncidentHistory_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SecfacSupervisorInspection` ADD CONSTRAINT `SecfacSupervisorInspection_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `ManpowerSite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SecfacSupervisorInspection` ADD CONSTRAINT `SecfacSupervisorInspection_checkpointId_fkey` FOREIGN KEY (`checkpointId`) REFERENCES `SecfacCheckpoint`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SecfacSupervisorInspection` ADD CONSTRAINT `SecfacSupervisorInspection_supervisorId_fkey` FOREIGN KEY (`supervisorId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SecfacSupervisorInspection` ADD CONSTRAINT `SecfacSupervisorInspection_inspectedEmployeeId_fkey` FOREIGN KEY (`inspectedEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SecfacSupervisorInspection` ADD CONSTRAINT `SecfacSupervisorInspection_checklistExecutionId_fkey` FOREIGN KEY (`checklistExecutionId`) REFERENCES `SecfacChecklistExecution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SecfacEvidenceAttachment` ADD CONSTRAINT `SecfacEvidenceAttachment_incidentId_fkey` FOREIGN KEY (`incidentId`) REFERENCES `SecfacIncident`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SecfacEvidenceAttachment` ADD CONSTRAINT `SecfacEvidenceAttachment_postOrderId_fkey` FOREIGN KEY (`postOrderId`) REFERENCES `SecfacPostOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

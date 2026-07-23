-- AlterTable: Add missing contractId and postId columns to SecFacWelfareCheck
ALTER TABLE `SecFacWelfareCheck` 
    ADD COLUMN `contractId` VARCHAR(191) NULL,
    ADD COLUMN `postId` VARCHAR(191) NULL;

-- CreateIndexes
CREATE INDEX `SecFacWelfareCheck_operationType_idx` ON `SecFacWelfareCheck`(`operationType`);
CREATE INDEX `SecFacWelfareCheck_companyId_idx` ON `SecFacWelfareCheck`(`companyId`);
CREATE INDEX `SecFacWelfareCheck_siteId_idx` ON `SecFacWelfareCheck`(`siteId`);
CREATE INDEX `SecFacWelfareCheck_employeeId_idx` ON `SecFacWelfareCheck`(`employeeId`);
CREATE INDEX `SecFacWelfareCheck_status_idx` ON `SecFacWelfareCheck`(`status`);
CREATE INDEX `SecFacWelfareCheck_dueAt_idx` ON `SecFacWelfareCheck`(`dueAt`);
CREATE INDEX `SecFacWelfareCheck_graceExpiresAt_idx` ON `SecFacWelfareCheck`(`graceExpiresAt`);

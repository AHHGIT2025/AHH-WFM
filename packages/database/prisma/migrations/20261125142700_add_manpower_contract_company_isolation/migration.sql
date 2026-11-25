-- AlterTable
ALTER TABLE `ManpowerClient` ADD COLUMN `companyId` VARCHAR(191) NULL,
    ADD COLUMN `isSharedClient` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `ManpowerContract` ADD COLUMN `companyId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ManpowerProject` ADD COLUMN `companyId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ContractApprovalWorkflow` ADD COLUMN `companyId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `ManpowerClient_companyId_idx` ON `ManpowerClient`(`companyId`);

-- CreateIndex
CREATE INDEX `ManpowerContract_companyId_idx` ON `ManpowerContract`(`companyId`);

-- CreateIndex
CREATE INDEX `ManpowerProject_companyId_idx` ON `ManpowerProject`(`companyId`);

-- CreateIndex
CREATE INDEX `ContractApprovalWorkflow_companyId_idx` ON `ContractApprovalWorkflow`(`companyId`);

-- AddForeignKey
ALTER TABLE `ManpowerClient` ADD CONSTRAINT `ManpowerClient_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerContract` ADD CONSTRAINT `ManpowerContract_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManpowerProject` ADD CONSTRAINT `ManpowerProject_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractApprovalWorkflow` ADD CONSTRAINT `ContractApprovalWorkflow_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

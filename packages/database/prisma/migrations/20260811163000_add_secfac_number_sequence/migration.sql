-- CreateTable
CREATE TABLE `secfac_number_sequences` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `recordType` VARCHAR(191) NOT NULL,
    `currentValue` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `secfac_number_sequences_companyId_period_idx`(`companyId`, `period`),
    UNIQUE INDEX `secfac_number_sequences_companyId_period_recordType_key`(`companyId`, `period`, `recordType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `secfac_number_sequences` ADD CONSTRAINT `secfac_number_sequences_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

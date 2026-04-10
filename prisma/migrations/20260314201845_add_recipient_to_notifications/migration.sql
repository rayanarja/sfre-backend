-- CreateTable
CREATE TABLE `Users` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `role` ENUM('admin', 'driver', 'passenger') NOT NULL,
    `registration_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Users_username_key`(`username`),
    UNIQUE INDEX `Users_email_key`(`email`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Drivers` (
    `driver_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `shift_time` VARCHAR(191) NULL,
    `status` ENUM('online', 'offline') NOT NULL DEFAULT 'offline',

    UNIQUE INDEX `Drivers_user_id_key`(`user_id`),
    PRIMARY KEY (`driver_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Buses` (
    `bus_id` INTEGER NOT NULL AUTO_INCREMENT,
    `plate_number` VARCHAR(191) NOT NULL,
    `route_id` INTEGER NULL,
    `current_status` ENUM('active', 'inactive', 'maintenance', 'breakdown') NOT NULL DEFAULT 'inactive',
    `current_lat` DOUBLE NULL,
    `current_lng` DOUBLE NULL,
    `last_update` DATETIME(3) NULL,

    UNIQUE INDEX `Buses_plate_number_key`(`plate_number`),
    PRIMARY KEY (`bus_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Routes` (
    `route_id` INTEGER NOT NULL AUTO_INCREMENT,
    `route_name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    PRIMARY KEY (`route_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Stations` (
    `station_id` INTEGER NOT NULL AUTO_INCREMENT,
    `route_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `order_index` INTEGER NULL,

    PRIMARY KEY (`station_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bus_Tracking_Log` (
    `log_id` INTEGER NOT NULL AUTO_INCREMENT,
    `bus_id` INTEGER NOT NULL,
    `station_id` INTEGER NULL,
    `lat` DOUBLE NOT NULL,
    `lng` DOUBLE NOT NULL,
    `speed` INTEGER NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscriptions` (
    `subscription_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `number_of_trips` INTEGER NOT NULL DEFAULT 0,
    `subscription_type` ENUM('daily', 'weekly', 'monthly') NOT NULL,

    PRIMARY KEY (`subscription_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notifications` (
    `notification_id` INTEGER NOT NULL AUTO_INCREMENT,
    `recipient_id` INTEGER NULL,
    `message` VARCHAR(191) NOT NULL,
    `sender_type` VARCHAR(191) NOT NULL DEFAULT 'admin',
    `sender_id` INTEGER NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`notification_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reports` (
    `report_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `bus_id` INTEGER NOT NULL,
    `type` ENUM('complaint', 'suggestion', 'incident') NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'reviewed', 'resolved') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`report_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Issues` (
    `issue_id` INTEGER NOT NULL AUTO_INCREMENT,
    `bus_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`issue_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lost_Items` (
    `item_id` INTEGER NOT NULL AUTO_INCREMENT,
    `bus_id` INTEGER NOT NULL,
    `reporter_id` INTEGER NOT NULL,
    `reporter_type` ENUM('passenger', 'driver') NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `found_location` VARCHAR(191) NULL,
    `status` ENUM('pending', 'lost', 'found', 'returned') NOT NULL DEFAULT 'lost',
    `report_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shifts` (
    `shift_id` INTEGER NOT NULL AUTO_INCREMENT,
    `driver_id` INTEGER NOT NULL,
    `bus_id` INTEGER NOT NULL,
    `shift_type` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `start_time` VARCHAR(191) NOT NULL,
    `end_time` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'scheduled',

    PRIMARY KEY (`shift_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Drivers` ADD CONSTRAINT `Drivers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Buses` ADD CONSTRAINT `Buses_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `Routes`(`route_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Stations` ADD CONSTRAINT `Stations_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `Routes`(`route_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bus_Tracking_Log` ADD CONSTRAINT `Bus_Tracking_Log_bus_id_fkey` FOREIGN KEY (`bus_id`) REFERENCES `Buses`(`bus_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bus_Tracking_Log` ADD CONSTRAINT `Bus_Tracking_Log_station_id_fkey` FOREIGN KEY (`station_id`) REFERENCES `Stations`(`station_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscriptions` ADD CONSTRAINT `Subscriptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reports` ADD CONSTRAINT `Reports_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reports` ADD CONSTRAINT `Reports_bus_id_fkey` FOREIGN KEY (`bus_id`) REFERENCES `Buses`(`bus_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Issues` ADD CONSTRAINT `Issues_bus_id_fkey` FOREIGN KEY (`bus_id`) REFERENCES `Buses`(`bus_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Issues` ADD CONSTRAINT `Issues_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lost_Items` ADD CONSTRAINT `Lost_Items_bus_id_fkey` FOREIGN KEY (`bus_id`) REFERENCES `Buses`(`bus_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lost_Items` ADD CONSTRAINT `Lost_Items_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shifts` ADD CONSTRAINT `Shifts_driver_id_fkey` FOREIGN KEY (`driver_id`) REFERENCES `Drivers`(`driver_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shifts` ADD CONSTRAINT `Shifts_bus_id_fkey` FOREIGN KEY (`bus_id`) REFERENCES `Buses`(`bus_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

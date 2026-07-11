ALTER TABLE `Stations` ADD COLUMN `direction` VARCHAR(191) NOT NULL DEFAULT 'outbound';

CREATE INDEX `Stations_route_id_direction_order_index_idx`
  ON `Stations`(`route_id`, `direction`, `order_index`);

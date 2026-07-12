ALTER TABLE `Stations` DROP FOREIGN KEY `Stations_route_id_fkey`;

DROP INDEX `Stations_route_id_direction_order_index_idx` ON `Stations`;

ALTER TABLE `Stations`
  DROP COLUMN `route_id`,
  DROP COLUMN `direction`,
  DROP COLUMN `order_index`;

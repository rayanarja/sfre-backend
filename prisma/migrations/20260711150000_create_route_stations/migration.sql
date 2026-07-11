CREATE TABLE IF NOT EXISTS `route_stations` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `route_id` INTEGER NOT NULL,
  `station_id` INTEGER NOT NULL,
  `direction` VARCHAR(191) NOT NULL,
  `station_order` INTEGER NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `route_stations_route_id_direction_station_order_key` (`route_id`, `direction`, `station_order`),
  INDEX `route_stations_route_id_direction_idx` (`route_id`, `direction`),
  INDEX `route_stations_station_id_idx` (`station_id`),
  CONSTRAINT `route_stations_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `Routes`(`route_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `route_stations_station_id_fkey` FOREIGN KEY (`station_id`) REFERENCES `Stations`(`station_id`) ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT IGNORE INTO `route_stations` (`route_id`, `station_id`, `direction`, `station_order`)
SELECT
  migrated.`route_id`,
  migrated.`station_id`,
  migrated.`direction`,
  migrated.`station_order`
FROM (
  SELECT
    s.`route_id`,
    s.`station_id`,
    COALESCE(s.`direction`, 'outbound') AS `direction`,
    ROW_NUMBER() OVER (
      PARTITION BY s.`route_id`, COALESCE(s.`direction`, 'outbound')
      ORDER BY COALESCE(s.`order_index`, 999999), s.`station_id`
    ) AS `station_order`
  FROM `Stations` s
  WHERE s.`route_id` IS NOT NULL
) migrated;

ALTER TABLE `Routes` DROP COLUMN `pair_route_id`;

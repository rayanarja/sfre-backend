ALTER TABLE `Buses` ALTER COLUMN `current_station_index` SET DEFAULT 1;

UPDATE `Buses`
SET `current_station_index` = 1
WHERE `current_station_index` = 0;

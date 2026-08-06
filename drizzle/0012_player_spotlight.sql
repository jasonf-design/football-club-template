ALTER TABLE `players` ADD `spotlight_photo_media_id` text REFERENCES `media`(`id`);
ALTER TABLE `players` ADD `spotlight_focal_x` real NOT NULL DEFAULT 0.5;
ALTER TABLE `players` ADD `spotlight_focal_y` real NOT NULL DEFAULT 0.5;

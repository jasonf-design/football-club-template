ALTER TABLE `coaching_staff` ADD `sponsor1_name` text;
ALTER TABLE `coaching_staff` ADD `sponsor1_url` text;
ALTER TABLE `coaching_staff` ADD `sponsor1_logo_media_id` text REFERENCES `media`(`id`);

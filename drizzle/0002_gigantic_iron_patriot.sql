ALTER TABLE `players` ADD `position2` text;--> statement-breakpoint
ALTER TABLE `players` ADD `sponsor1_name` text;--> statement-breakpoint
ALTER TABLE `players` ADD `sponsor1_url` text;--> statement-breakpoint
ALTER TABLE `players` ADD `sponsor1_logo_media_id` text REFERENCES media(id);--> statement-breakpoint
ALTER TABLE `players` ADD `sponsor2_name` text;--> statement-breakpoint
ALTER TABLE `players` ADD `sponsor2_url` text;--> statement-breakpoint
ALTER TABLE `players` ADD `sponsor2_logo_media_id` text REFERENCES media(id);
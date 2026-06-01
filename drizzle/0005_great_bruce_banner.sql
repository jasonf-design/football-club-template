CREATE TABLE `coaching_staff` (
	`id` text PRIMARY KEY NOT NULL,
	`team` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`photo_media_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`photo_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);

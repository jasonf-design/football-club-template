CREATE TABLE `programmes` (
	`id` text PRIMARY KEY NOT NULL,
	`fixture_id` text REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE set null,
	`status` text NOT NULL DEFAULT 'draft',
	`cover_image_media_id` text REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	`managers_notes` text,
	`opposition_profile` text,
	`featured_player_id` text REFERENCES `players`(`id`) ON UPDATE no action ON DELETE set null,
	`featured_sponsor_id` text REFERENCES `sponsors`(`id`) ON UPDATE no action ON DELETE set null,
	`cover_sponsor_id` text REFERENCES `sponsors`(`id`) ON UPDATE no action ON DELETE set null,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `programme_interest` (
	`id` text PRIMARY KEY NOT NULL,
	`programme_id` text NOT NULL REFERENCES `programmes`(`id`) ON UPDATE no action ON DELETE cascade,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

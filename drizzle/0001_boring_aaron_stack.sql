CREATE TABLE `fwp_snapshots` (
	`key` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`fetched_at` integer DEFAULT (unixepoch()) NOT NULL
);

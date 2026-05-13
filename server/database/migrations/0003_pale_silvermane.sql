CREATE TABLE `contact_files` (
	`contact_id` text NOT NULL,
	`file_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	PRIMARY KEY(`contact_id`, `file_id`),
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cf_contact_idx` ON `contact_files` (`contact_id`);--> statement-breakpoint
CREATE INDEX `cf_file_idx` ON `contact_files` (`file_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`folder_id` text,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_path` text NOT NULL,
	`share_token` text,
	`share_enabled` integer DEFAULT false NOT NULL,
	`share_expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_share_token_unique` ON `files` (`share_token`);--> statement-breakpoint
CREATE INDEX `files_user_idx` ON `files` (`user_id`);--> statement-breakpoint
CREATE INDEX `files_folder_idx` ON `files` (`folder_id`);--> statement-breakpoint
CREATE INDEX `files_share_idx` ON `files` (`share_token`);--> statement-breakpoint
CREATE TABLE `note_files` (
	`note_id` text NOT NULL,
	`file_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	PRIMARY KEY(`note_id`, `file_id`),
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `nf_note_idx` ON `note_files` (`note_id`);--> statement-breakpoint
CREATE INDEX `nf_file_idx` ON `note_files` (`file_id`);
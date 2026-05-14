ALTER TABLE `files` ADD `title` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `files` ADD `description` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `files` SET `title` = `original_name` WHERE `title` = '';
--> statement-breakpoint
CREATE TABLE `file_field_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`field_type` text DEFAULT 'text' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fft_user_idx` ON `file_field_templates` (`user_id`);
--> statement-breakpoint
CREATE TABLE `file_field_values` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`template_id` text,
	`label` text NOT NULL,
	`field_type` text DEFAULT 'text' NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `file_field_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ffv_file_idx` ON `file_field_values` (`file_id`);

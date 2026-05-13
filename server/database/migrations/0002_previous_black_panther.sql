CREATE TABLE `contact_field_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`contact_type` text NOT NULL,
	`label` text NOT NULL,
	`field_type` text DEFAULT 'text' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cft_user_type_idx` ON `contact_field_templates` (`user_id`,`contact_type`);--> statement-breakpoint
CREATE TABLE `contact_field_values` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`template_id` text,
	`label` text NOT NULL,
	`field_type` text DEFAULT 'text' NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `contact_field_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `cfv_contact_idx` ON `contact_field_values` (`contact_id`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`folder_id` text,
	`type` text DEFAULT 'person' NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`org_name` text DEFAULT '' NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `contacts_user_idx` ON `contacts` (`user_id`);--> statement-breakpoint
CREATE INDEX `contacts_folder_idx` ON `contacts` (`folder_id`);--> statement-breakpoint
CREATE INDEX `contacts_type_idx` ON `contacts` (`type`);--> statement-breakpoint
CREATE INDEX `contacts_display_idx` ON `contacts` (`display_name`);--> statement-breakpoint
CREATE TABLE `note_contacts` (
	`note_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	PRIMARY KEY(`note_id`, `contact_id`),
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `nc_note_idx` ON `note_contacts` (`note_id`);--> statement-breakpoint
CREATE INDEX `nc_contact_idx` ON `note_contacts` (`contact_id`);--> statement-breakpoint
CREATE INDEX `nc_source_idx` ON `note_contacts` (`source`);
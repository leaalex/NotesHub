CREATE TABLE `addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`folder_id` text,
	`label` text DEFAULT '' NOT NULL,
	`line1` text DEFAULT '' NOT NULL,
	`line2` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`postal_code` text DEFAULT '' NOT NULL,
	`country_code` text DEFAULT '' NOT NULL,
	`lat` text,
	`lng` text,
	`provider` text DEFAULT 'nominatim' NOT NULL,
	`provider_id` text,
	`raw_json` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `addr_user_idx` ON `addresses` (`user_id`);--> statement-breakpoint
CREATE INDEX `addr_folder_idx` ON `addresses` (`folder_id`);--> statement-breakpoint
CREATE INDEX `addr_user_country_idx` ON `addresses` (`user_id`,`country_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `addr_user_provider_uid` ON `addresses` (`user_id`,`provider`,`provider_id`) WHERE `provider_id` IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `contact_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`address_id` text NOT NULL,
	`role` text DEFAULT 'other' NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`address_id`) REFERENCES `addresses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ca_contact_address_uid` ON `contact_addresses` (`contact_id`,`address_id`);--> statement-breakpoint
CREATE INDEX `ca_contact_idx` ON `contact_addresses` (`contact_id`);--> statement-breakpoint
CREATE INDEX `ca_address_idx` ON `contact_addresses` (`address_id`);

CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`folder_id` text,
	`parent_id` text,
	`title` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`due_at` integer,
	`completed_at` integer,
	`position` integer DEFAULT 0 NOT NULL,
	`share_token` text,
	`share_enabled` integer DEFAULT false NOT NULL,
	`share_expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_share_token_unique` ON `tasks` (`share_token`);--> statement-breakpoint
CREATE INDEX `tasks_user_idx` ON `tasks` (`user_id`);--> statement-breakpoint
CREATE INDEX `tasks_folder_idx` ON `tasks` (`folder_id`);--> statement-breakpoint
CREATE INDEX `tasks_parent_idx` ON `tasks` (`parent_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_due_idx` ON `tasks` (`due_at`);--> statement-breakpoint
CREATE INDEX `tasks_share_idx` ON `tasks` (`share_token`);--> statement-breakpoint
CREATE TABLE `task_field_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`field_type` text DEFAULT 'text' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_ft_user_idx` ON `task_field_templates` (`user_id`);--> statement-breakpoint
CREATE TABLE `task_field_values` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`template_id` text,
	`label` text NOT NULL,
	`field_type` text DEFAULT 'text' NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `task_field_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `task_fv_task_idx` ON `task_field_values` (`task_id`);--> statement-breakpoint
CREATE TABLE `note_tasks` (
	`note_id` text NOT NULL,
	`task_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	PRIMARY KEY(`note_id`, `task_id`),
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `nt_note_idx` ON `note_tasks` (`note_id`);--> statement-breakpoint
CREATE INDEX `nt_task_idx` ON `note_tasks` (`task_id`);--> statement-breakpoint
CREATE TABLE `contact_tasks` (
	`contact_id` text NOT NULL,
	`task_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	PRIMARY KEY(`contact_id`, `task_id`),
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ct_contact_idx` ON `contact_tasks` (`contact_id`);--> statement-breakpoint
CREATE INDEX `ct_task_idx` ON `contact_tasks` (`task_id`);--> statement-breakpoint
CREATE TABLE `task_files` (
	`task_id` text NOT NULL,
	`file_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	PRIMARY KEY(`task_id`, `file_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tf_task_idx` ON `task_files` (`task_id`);--> statement-breakpoint
CREATE INDEX `tf_file_idx` ON `task_files` (`file_id`);

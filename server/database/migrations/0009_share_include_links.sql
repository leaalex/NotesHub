ALTER TABLE `notes` ADD `share_include_links` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `contacts` ADD `share_include_links` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `share_include_links` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `files` ADD `share_include_links` integer DEFAULT 1 NOT NULL;

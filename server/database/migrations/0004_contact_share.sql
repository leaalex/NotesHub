ALTER TABLE `contacts` ADD `share_token` text;
--> statement-breakpoint
ALTER TABLE `contacts` ADD `share_enabled` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `contacts` ADD `share_expires_at` integer;
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_share_token_unique` ON `contacts` (`share_token`);
--> statement-breakpoint
CREATE INDEX `contacts_share_idx` ON `contacts` (`share_token`);

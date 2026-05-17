UPDATE `contact_field_templates` SET `field_type` = 'longtext' WHERE `field_type` = 'address';
--> statement-breakpoint
UPDATE `contact_field_values` SET `field_type` = 'longtext' WHERE `field_type` = 'address';
--> statement-breakpoint
UPDATE `task_field_templates` SET `field_type` = 'longtext' WHERE `field_type` = 'address';
--> statement-breakpoint
UPDATE `task_field_values` SET `field_type` = 'longtext' WHERE `field_type` = 'address';
--> statement-breakpoint
UPDATE `file_field_templates` SET `field_type` = 'longtext' WHERE `field_type` = 'address';
--> statement-breakpoint
UPDATE `file_field_values` SET `field_type` = 'longtext' WHERE `field_type` = 'address';

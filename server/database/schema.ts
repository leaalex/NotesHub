// Tables filled by `npx better-auth generate` and extended with app models.
import { relations, sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core'

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  role: text('role'),
  banned: integer('banned', { mode: 'boolean' }),
  banReason: text('ban_reason'),
  banExpires: integer('ban_expires', { mode: 'timestamp_ms' }),
})

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    impersonatedBy: text('impersonated_by'),
  },
  (table) => [index('session_userId_idx').on(table.userId)]
)

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)]
)

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))

export const folders = sqliteTable(
  'folders',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references(() => folders.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`),
  },
  (t) => [
    index('folders_user_idx').on(t.userId),
    index('folders_parent_idx').on(t.parentId),
  ]
)

export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    folderId: text('folder_id').references(() => folders.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull().default(''),
    content: text('content').notNull().default('{}'),
    excerpt: text('excerpt').notNull().default(''),
    shareToken: text('share_token').unique(),
    shareEnabled: integer('share_enabled', { mode: 'boolean' })
      .notNull()
      .default(false),
    shareExpiresAt: integer('share_expires_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`),
  },
  (t) => [
    index('notes_user_idx').on(t.userId),
    index('notes_folder_idx').on(t.folderId),
    index('notes_share_idx').on(t.shareToken),
  ]
)

export const contacts = sqliteTable(
  'contacts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    folderId: text('folder_id').references(() => folders.id, {
      onDelete: 'set null',
    }),
    type: text('type').notNull().default('person'),
    firstName: text('first_name').notNull().default(''),
    lastName: text('last_name').notNull().default(''),
    orgName: text('org_name').notNull().default(''),
    displayName: text('display_name').notNull().default(''),
    note: text('note').notNull().default(''),
    shareToken: text('share_token').unique(),
    shareEnabled: integer('share_enabled', { mode: 'boolean' })
      .notNull()
      .default(false),
    shareExpiresAt: integer('share_expires_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`),
  },
  (t) => [
    index('contacts_user_idx').on(t.userId),
    index('contacts_folder_idx').on(t.folderId),
    index('contacts_type_idx').on(t.type),
    index('contacts_display_idx').on(t.displayName),
    index('contacts_share_idx').on(t.shareToken),
  ]
)

export const contactFieldTemplates = sqliteTable(
  'contact_field_templates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    contactType: text('contact_type').notNull(),
    label: text('label').notNull(),
    fieldType: text('field_type').notNull().default('text'),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('cft_user_type_idx').on(t.userId, t.contactType)]
)

export const contactFieldValues = sqliteTable(
  'contact_field_values',
  {
    id: text('id').primaryKey(),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    templateId: text('template_id').references(() => contactFieldTemplates.id, {
      onDelete: 'set null',
    }),
    label: text('label').notNull(),
    fieldType: text('field_type').notNull().default('text'),
    value: text('value').notNull().default(''),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('cfv_contact_idx').on(t.contactId)]
)

export const noteContacts = sqliteTable(
  'note_contacts',
  {
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    source: text('source').notNull().default('manual'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`),
  },
  (t) => [
    primaryKey({ columns: [t.noteId, t.contactId] }),
    index('nc_note_idx').on(t.noteId),
    index('nc_contact_idx').on(t.contactId),
    index('nc_source_idx').on(t.source),
  ]
)

export const files = sqliteTable(
  'files',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    folderId: text('folder_id').references(() => folders.id, {
      onDelete: 'set null',
    }),
    originalName: text('original_name').notNull(),
    title: text('title').notNull().default(''),
    description: text('description').notNull().default(''),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    storagePath: text('storage_path').notNull(),
    shareToken: text('share_token').unique(),
    shareEnabled: integer('share_enabled', { mode: 'boolean' })
      .notNull()
      .default(false),
    shareExpiresAt: integer('share_expires_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`),
  },
  (t) => [
    index('files_user_idx').on(t.userId),
    index('files_folder_idx').on(t.folderId),
    index('files_share_idx').on(t.shareToken),
  ]
)

export const fileFieldTemplates = sqliteTable(
  'file_field_templates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    fieldType: text('field_type').notNull().default('text'),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('fft_user_idx').on(t.userId)]
)

export const fileFieldValues = sqliteTable(
  'file_field_values',
  {
    id: text('id').primaryKey(),
    fileId: text('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    templateId: text('template_id').references(() => fileFieldTemplates.id, {
      onDelete: 'set null',
    }),
    label: text('label').notNull(),
    fieldType: text('field_type').notNull().default('text'),
    value: text('value').notNull().default(''),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('ffv_file_idx').on(t.fileId)]
)

export const noteFiles = sqliteTable(
  'note_files',
  {
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    fileId: text('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`),
  },
  (t) => [
    primaryKey({ columns: [t.noteId, t.fileId] }),
    index('nf_note_idx').on(t.noteId),
    index('nf_file_idx').on(t.fileId),
  ]
)

export const contactFiles = sqliteTable(
  'contact_files',
  {
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    fileId: text('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(strftime('%s','now') * 1000)`),
  },
  (t) => [
    primaryKey({ columns: [t.contactId, t.fileId] }),
    index('cf_contact_idx').on(t.contactId),
    index('cf_file_idx').on(t.fileId),
  ]
)

export const folderRelations = relations(folders, ({ one, many }) => ({
  user: one(user, {
    fields: [folders.userId],
    references: [user.id],
  }),
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: 'folderHierarchy',
  }),
  children: many(folders, { relationName: 'folderHierarchy' }),
  notes: many(notes),
  contacts: many(contacts),
  files: many(files),
}))

export const noteRelations = relations(notes, ({ one, many }) => ({
  user: one(user, {
    fields: [notes.userId],
    references: [user.id],
  }),
  folder: one(folders, {
    fields: [notes.folderId],
    references: [folders.id],
  }),
  linkedContacts: many(noteContacts),
  linkedFiles: many(noteFiles),
}))

export const contactRelations = relations(contacts, ({ one, many }) => ({
  user: one(user, {
    fields: [contacts.userId],
    references: [user.id],
  }),
  folder: one(folders, {
    fields: [contacts.folderId],
    references: [folders.id],
  }),
  fieldValues: many(contactFieldValues),
  linkedNotes: many(noteContacts),
  linkedFiles: many(contactFiles),
}))

export const contactFieldTemplateRelations = relations(
  contactFieldTemplates,
  ({ one, many }) => ({
    user: one(user, {
      fields: [contactFieldTemplates.userId],
      references: [user.id],
    }),
    values: many(contactFieldValues),
  })
)

export const contactFieldValueRelations = relations(
  contactFieldValues,
  ({ one }) => ({
    contact: one(contacts, {
      fields: [contactFieldValues.contactId],
      references: [contacts.id],
    }),
    template: one(contactFieldTemplates, {
      fields: [contactFieldValues.templateId],
      references: [contactFieldTemplates.id],
    }),
  })
)

export const noteContactRelations = relations(noteContacts, ({ one }) => ({
  note: one(notes, {
    fields: [noteContacts.noteId],
    references: [notes.id],
  }),
  contact: one(contacts, {
    fields: [noteContacts.contactId],
    references: [contacts.id],
  }),
}))

export const fileRelations = relations(files, ({ one, many }) => ({
  user: one(user, {
    fields: [files.userId],
    references: [user.id],
  }),
  folder: one(folders, {
    fields: [files.folderId],
    references: [folders.id],
  }),
  linkedNotes: many(noteFiles),
  linkedContacts: many(contactFiles),
  fieldValues: many(fileFieldValues),
}))

export const fileFieldTemplateRelations = relations(fileFieldTemplates, ({ one, many }) => ({
  user: one(user, {
    fields: [fileFieldTemplates.userId],
    references: [user.id],
  }),
  values: many(fileFieldValues),
}))

export const fileFieldValueRelations = relations(fileFieldValues, ({ one }) => ({
  file: one(files, {
    fields: [fileFieldValues.fileId],
    references: [files.id],
  }),
  template: one(fileFieldTemplates, {
    fields: [fileFieldValues.templateId],
    references: [fileFieldTemplates.id],
  }),
}))

export const noteFileRelations = relations(noteFiles, ({ one }) => ({
  note: one(notes, {
    fields: [noteFiles.noteId],
    references: [notes.id],
  }),
  file: one(files, {
    fields: [noteFiles.fileId],
    references: [files.id],
  }),
}))

export const contactFileRelations = relations(contactFiles, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactFiles.contactId],
    references: [contacts.id],
  }),
  file: one(files, {
    fields: [contactFiles.fileId],
    references: [files.id],
  }),
}))

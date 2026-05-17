export type ContactKind = 'person' | 'organization'

export type ContactFieldKind =
  | 'text'
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'longtext'

export type NoteContactSource = 'manual' | 'mention'

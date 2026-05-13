# Visual Audit Matrix

Strict route-by-route checklist for UI normalization.

## Product routes

| Route | File | Issues found | Status |
|---|---|---|---|
| `/` | `app/pages/index.vue` | mixed section labels, local scrollbar CSS, custom empty-state card markup | fixed |
| `/contacts` shell | `app/pages/contacts.vue` | local scrollbar CSS, manual section labels, inconsistent empty list style | fixed |
| `/contacts/index` | `app/pages/contacts/index.vue` | duplicated empty-state card surface | fixed |
| `/contacts/new` | `app/pages/contacts/new.vue` | custom form panel surface differed from glass standard | fixed |
| `/contacts/:id` | `app/pages/contacts/[id].vue` | modal scrollbars missing global class, select typography mismatch | fixed |
| `/contacts/templates` | `app/pages/contacts/templates.vue` | loading state differed, select controls inconsistent, title weight mismatch | fixed |
| `/files` | `app/pages/files/index.vue` | duplicated section labels and empty-state card patterns | fixed |
| `/login` | `app/pages/login.vue` | custom outer card shell duplicated glass panel pattern | fixed |
| `/share/:token` | `app/pages/share/[token].vue` | local scrollbar CSS, manual section labels, pending state surface mismatch | fixed |

## Admin/CMS routes

| Route | File | Issues found | Status |
|---|---|---|---|
| `/staff` | `app/pages/staff/index.vue` | hub card style diverged from standardized page rhythm | fixed |
| `/staff/users` | `app/pages/staff/users.vue` | title scale and table shell differed, select/button sizing drift | fixed |
| `/cms` | `app/pages/cms/index.vue` | hub card style diverged from standardized page rhythm | fixed |
| `/cms/notes` | `app/pages/cms/notes.vue` | table wrapper radius/ring and toolbar controls inconsistent | fixed |
| `/cms/folders` | `app/pages/cms/folders.vue` | table wrapper radius/ring and toolbar controls inconsistent | fixed |

## Shared foundation

| Area | File | Issues found | Status |
|---|---|---|---|
| scrollbar utility | `app/assets/css/main.css` | repeated page-scoped scrollbar styles | fixed |
| 3-column main pane | `app/components/layout/AppThreeColumn.vue` | referenced old local scrollbar class | fixed |
| section labels | `app/components/ui/SectionLabel.vue` | repeated ad-hoc uppercase label classes | fixed |
| glass panels | `app/components/ui/GlassPanel.vue` | repeated long glass surface class strings | fixed |
| empty states | `app/components/ui/EmptyState.vue` | repeated empty state card structures | fixed |
| page/table/control utilities | `app/assets/css/main.css` | repeated per-page page-header/table/select class combinations | fixed |

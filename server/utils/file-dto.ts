import type { files } from '../database/schema'

type FileRow = typeof files.$inferSelect

export function toFileDto(row: FileRow, siteUrl: string) {
  const base = siteUrl.replace(/\/$/, '')
  return {
    id: row.id,
    originalName: row.originalName,
    title: row.title ?? '',
    description: row.description ?? '',
    mimeType: row.mimeType,
    size: row.size,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    shareEnabled: row.shareEnabled,
    shareToken: row.shareToken,
    downloadUrl: `/api/files/${row.id}/download`,
    shareUrl: row.shareEnabled && row.shareToken ? `${base}/share/file/${row.shareToken}` : null,
  }
}

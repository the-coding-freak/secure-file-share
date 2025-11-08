"use client"

import { UploadPanel } from "./upload-panel"

/**
 * Thin wrapper kept for legacy screens that still render <FileUpload />.
 */
export function FileUpload() {
  return <UploadPanel />
}

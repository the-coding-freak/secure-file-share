"use client"

import { DownloadPanel } from "./download-panel"

/**
 * Backwards-compatible wrapper so legacy routes can render the new download workflow.
 */
export function FileDownload() {
  return <DownloadPanel />
}

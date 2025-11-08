"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { retrieveFromPinata } from "@/lib/ipfs"
import { getFileMetadata } from "@/lib/contract"
import { decryptData } from "@/lib/crypto"
import { Download, Loader } from "lucide-react"

export function FileDownload() {
  const [fileId, setFileId] = useState("")
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState("")

  function base64Decode(str: string): string {
    return decodeURIComponent(escape(atob(str)))
  }

  const handleDownload = async () => {
    if (!fileId) {
      alert("Please enter file ID")
      return
    }

    setIsDownloading(true)
    try {
      setDownloadStatus("Fetching file metadata...")
      const metadata = await getFileMetadata(fileId)

      setDownloadStatus("Downloading from IPFS...")
      const encryptedBlob = await retrieveFromPinata(metadata.ipfsHash)
      const encryptedText = await encryptedBlob.text()

      setDownloadStatus("Decrypting file...")
      const decrypted = decryptData(encryptedText, metadata.encryptionKey, "iv-placeholder")

      const decodedBase64 = base64Decode(decrypted)
      const encoder = new TextEncoder()
      const binaryData = encoder.encode(decodedBase64)
      const blob = new Blob([binaryData], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `decrypted-${Date.now()}`
      a.click()
      URL.revokeObjectURL(url)

      setDownloadStatus("Download complete!")
      setTimeout(() => setDownloadStatus(""), 3000)
    } catch (error) {
      console.error("[v0] Download error:", error)
      setDownloadStatus(`Download failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Card className="p-6 w-full max-w-md">
      <h3 className="text-lg font-semibold mb-4">Download File</h3>

      <div className="space-y-4">
        <div>
          <Label htmlFor="file-id">File ID</Label>
          <Input
            id="file-id"
            placeholder="Enter file ID..."
            value={fileId}
            onChange={(e) => setFileId(e.target.value)}
            disabled={isDownloading}
          />
        </div>

        <Button onClick={handleDownload} disabled={!fileId || isDownloading} className="w-full gap-2">
          {isDownloading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download
            </>
          )}
        </Button>

        {downloadStatus && <div className="text-sm text-muted-foreground text-center">{downloadStatus}</div>}
      </div>
    </Card>
  )
}

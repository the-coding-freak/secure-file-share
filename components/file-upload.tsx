"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { uploadToPinata } from "@/lib/ipfs"
import { uploadFileToBlockchain } from "@/lib/contract"
import { generateEncryptionKey, generateIV, encryptData } from "@/lib/crypto"
import { Upload, Loader } from "lucide-react"

export function FileUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>("")

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setUploadStatus("")
    }
  }

  function base64Encode(str: string): string {
    return btoa(unescape(encodeURIComponent(str)))
  }

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file")
      return
    }

    setIsUploading(true)
    try {
      setUploadStatus("Generating encryption keys...")
      const encryptionKey = generateEncryptionKey()
      const iv = generateIV()

      setUploadStatus("Encrypting file...")
      const fileData = await file.arrayBuffer()
      const decoder = new TextDecoder()
      const base64Data = base64Encode(decoder.decode(fileData))
      const encrypted = encryptData(base64Data, encryptionKey, iv)

      setUploadStatus("Uploading to IPFS...")
      const encryptedBlob = new Blob([encrypted], { type: "application/octet-stream" })
      const ipfsHash = await uploadToPinata(encryptedBlob, file.name)

      setUploadStatus("Recording on blockchain...")
      await uploadFileToBlockchain(ipfsHash, encryptionKey, isPublic)

      setUploadStatus("Upload complete!")
      setFile(null)
      setTimeout(() => setUploadStatus(""), 3000)
    } catch (error) {
      console.error("[v0] Upload error:", error)
      setUploadStatus(`Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Card className="p-6 w-full max-w-md">
      <h3 className="text-lg font-semibold mb-4">Upload File</h3>

      <div className="space-y-4">
        <div>
          <Label htmlFor="file-input">Select File</Label>
          <Input id="file-input" type="file" onChange={handleFileSelect} disabled={isUploading} />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="public" checked={isPublic} onCheckedChange={(checked) => setIsPublic(checked as boolean)} />
          <Label htmlFor="public" className="cursor-pointer">
            Make file public
          </Label>
        </div>

        <Button onClick={handleUpload} disabled={!file || isUploading} className="w-full gap-2">
          {isUploading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload File
            </>
          )}
        </Button>

        {uploadStatus && <div className="text-sm text-muted-foreground text-center">{uploadStatus}</div>}
      </div>
    </Card>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { shareFileWithUser, revokeFileAccess, getUserFilesList } from "@/lib/contract"
import { getConnectedAddress } from "@/lib/wallet"
import { Share2, Trash2, Lock } from "lucide-react"

export function FileList() {
  const [files, setFiles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [shareAddress, setShareAddress] = useState<{ [key: string]: string }>({})

  const loadUserFiles = async () => {
    try {
      setIsLoading(true)
      const address = getConnectedAddress()
      if (!address) {
        alert("Wallet not connected")
        return
      }

      const userFiles = await getUserFilesList(address)
      setFiles(userFiles.map((id: any) => ({ id, isShared: false })))
    } catch (error) {
      console.error("Error loading files:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleShare = async (fileId: string) => {
    const recipientAddress = shareAddress[fileId]
    if (!recipientAddress) {
      alert("Please enter recipient address")
      return
    }

    try {
      await shareFileWithUser(fileId, recipientAddress)
      alert("File shared successfully!")
      setShareAddress((prev) => ({ ...prev, [fileId]: "" }))
    } catch (error) {
      console.error("Share error:", error)
      alert("Failed to share file")
    }
  }

  const handleRevoke = async (fileId: string) => {
    try {
      const address = prompt("Enter recipient address to revoke access:")
      if (!address) return

      await revokeFileAccess(fileId, address)
      alert("Access revoked!")
    } catch (error) {
      console.error("Revoke error:", error)
      alert("Failed to revoke access")
    }
  }

  useEffect(() => {
    loadUserFiles()
  }, [])

  if (isLoading) return <div className="text-center">Loading files...</div>

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Your Files</h3>

      {files.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">No files uploaded yet</Card>
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <Card key={file.id} className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-green-600" />
                    <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{file.id.slice(0, 8)}...</code>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRevoke(file.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Recipient address (0x...)"
                    value={shareAddress[file.id] || ""}
                    onChange={(e) => setShareAddress((prev) => ({ ...prev, [file.id]: e.target.value }))}
                  />
                  <Button onClick={() => handleShare(file.id)} size="sm" className="gap-2">
                    <Share2 className="w-4 h-4" />
                    Share
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

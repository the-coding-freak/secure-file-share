"use client"

import type { ChangeEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/hooks/use-wallet"
import {
  getCidForCurrentAccount,
  getEncryptedKeyForCurrentAccount,
  getOwnerFileIds,
  grantAccessOnChain,
  revokeFileAccess,
} from "@/lib/contract"
import { wrapAesKeyWithRsa, unwrapAesKeyWithRsa } from "@/lib/crypto"
import { RSA_PRIVATE_KEY_STORAGE_KEY, RSA_PUBLIC_KEY_STORAGE_KEY } from "@/lib/key-storage"
import { type OwnerFileRecord, getOwnerFileRecord, recordRevokeEvent, recordShareEvent } from "@/lib/owner-files"
import { getConnectedAddress } from "@/lib/wallet"
import { CheckCircle2, Copy, Loader2, Lock, RefreshCw, ShieldAlert, Share2, Trash2 } from "lucide-react"

interface OwnerFileSummary {
  fileId: string
  cid: string
}

interface ShareSuccess {
  type: "share" | "revoke"
  txHash: string
  timestamp: string
  recipient: string
}

interface ShareFormState {
  recipientAddress: string
  recipientPublicKey: string
  note?: string
  isProcessing: boolean
  status: string
  error: string | null
  success: ShareSuccess | null
}

const EMPTY_SHARE_FORM: ShareFormState = {
  recipientAddress: "",
  recipientPublicKey: "",
  note: "",
  isProcessing: false,
  status: "Idle",
  error: null,
  success: null,
}

function formatAddress(value: string): string {
  return value.trim()
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === "string") {
    return error
  }
  return "Unexpected error"
}

export function SharePanel() {
  const { address, isConnected, connect, connecting } = useWallet()
  const { toast } = useToast()
  const [ownerPublicKey, setOwnerPublicKey] = useState<string | null>(null)
  const [ownerPrivateKey, setOwnerPrivateKey] = useState<string | null>(null)
  const [files, setFiles] = useState<OwnerFileSummary[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [shareStates, setShareStates] = useState<Record<string, ShareFormState>>({})
  const [metadata, setMetadata] = useState<Record<string, OwnerFileRecord | undefined>>({})

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    setOwnerPublicKey(window.localStorage.getItem(RSA_PUBLIC_KEY_STORAGE_KEY))
    setOwnerPrivateKey(window.localStorage.getItem(RSA_PRIVATE_KEY_STORAGE_KEY))
  }, [])

  const defaultOwnerAddress = useMemo(() => address ?? getConnectedAddress(), [address])

  const updateShareState = (fileId: string, updates: Partial<ShareFormState>) => {
    setShareStates((prev) => ({
      ...prev,
      [fileId]: {
        ...EMPTY_SHARE_FORM,
        ...prev[fileId],
        ...updates,
      },
    }))
  }

  const handleConnectWallet = async () => {
    try {
      await connect()
    } catch (error: unknown) {
      console.error("[share-panel] Wallet connect failed", error)
      setLoadError(getErrorMessage(error))
    }
  }

  const loadOwnerFiles = async () => {
    if (!defaultOwnerAddress) {
      return
    }

    try {
      setLoadingFiles(true)
      setLoadError(null)
      const fileIds = await getOwnerFileIds(defaultOwnerAddress)
      const summaries: OwnerFileSummary[] = []
      const metaByFile: Record<string, ReturnType<typeof getOwnerFileRecord>> = {}

      for (const fileId of fileIds) {
        try {
          const cid = await getCidForCurrentAccount(fileId)
          summaries.push({ fileId, cid })
          metaByFile[fileId] = getOwnerFileRecord(fileId)
        } catch (error: unknown) {
          console.error("[share-panel] Failed to load CID", fileId, error)
          summaries.push({ fileId, cid: "" })
        }
      }

      setFiles(summaries)
      setMetadata(metaByFile)
      setShareStates(
        summaries.reduce<Record<string, ShareFormState>>((acc, file) => {
          acc[file.fileId] = shareStates[file.fileId] ?? { ...EMPTY_SHARE_FORM }
          return acc
        }, {}),
      )
    } catch (error: unknown) {
      console.error("[share-panel] Failed to load owner files", error)
      setLoadError(getErrorMessage(error))
    } finally {
      setLoadingFiles(false)
    }
  }

  useEffect(() => {
    if (defaultOwnerAddress && isConnected) {
      void loadOwnerFiles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOwnerAddress, isConnected])

  const handleShareInputChange = (fileId: string, field: "recipientAddress" | "recipientPublicKey" | "note") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      updateShareState(fileId, {
        [field]: event.target.value,
        error: null,
        success: null,
      })
    }

  const applyRecipientFromHistory = (fileId: string, recipient: string, note?: string) => {
    updateShareState(fileId, {
      recipientAddress: recipient,
      note: note ?? "",
    })
    toast({ title: "Recipient loaded", description: "Prefilled form with previous recipient details." })
  }

  const ensureOwnerKeysPresent = (): boolean => {
    if (!ownerPrivateKey || !ownerPublicKey) {
      return false
    }
    return true
  }

  const handleGrantAccess = async (fileId: string) => {
    const shareState = shareStates[fileId] ?? EMPTY_SHARE_FORM
    const recipientAddress = formatAddress(shareState.recipientAddress)
    const recipientPublicKey = shareState.recipientPublicKey.trim()

    if (!isConnected || !defaultOwnerAddress) {
      updateShareState(fileId, { error: "Connect your wallet to grant access." })
      return
    }
    if (!ensureOwnerKeysPresent()) {
      updateShareState(fileId, { error: "Generate your RSA key pair before sharing." })
      return
    }
    if (!recipientAddress) {
      updateShareState(fileId, { error: "Recipient address is required." })
      return
    }
    if (!recipientPublicKey) {
      updateShareState(fileId, { error: "Recipient RSA public key is required." })
      return
    }

    try {
      updateShareState(fileId, {
        isProcessing: true,
        status: "Preparing access payload",
        error: null,
        success: null,
      })

  const ownerEncryptedKey = await getEncryptedKeyForCurrentAccount(fileId)
      if (!ownerEncryptedKey) {
        throw new Error("Owner encryption payload missing on chain")
      }

      let parsedPayload: any
      try {
        parsedPayload = JSON.parse(ownerEncryptedKey)
      } catch (error) {
        throw new Error("Stored encryption payload is not valid JSON")
      }

      if (typeof parsedPayload?.wrappedKey !== "string") {
        throw new Error("Stored encryption payload is missing the wrapped key")
      }

      updateShareState(fileId, { status: "Unwrapping AES key" })
      const aesKey = await unwrapAesKeyWithRsa(ownerPrivateKey as string, parsedPayload.wrappedKey)

      updateShareState(fileId, { status: "Wrapping key for recipient" })
      const recipientWrappedKey = await wrapAesKeyWithRsa(recipientPublicKey, aesKey)

      const payloadForRecipient = {
        ...parsedPayload,
        wrappedKey: recipientWrappedKey,
        sharedBy: defaultOwnerAddress,
        sharedAt: new Date().toISOString(),
        note: shareState.note?.trim() || undefined,
      }

      updateShareState(fileId, { status: "Submitting transaction" })
      const { txHash } = await grantAccessOnChain(fileId, recipientAddress, JSON.stringify(payloadForRecipient))

      updateShareState(fileId, {
        isProcessing: false,
        status: "Access granted",
        success: {
          type: "share",
          txHash,
          timestamp: new Date().toISOString(),
          recipient: recipientAddress,
        },
      })

      recordShareEvent({
        fileId,
        recipient: recipientAddress,
        note: shareState.note?.trim() || undefined,
        timestamp: new Date().toISOString(),
        txHash,
      })
      setMetadata((prev) => ({
        ...prev,
        [fileId]: getOwnerFileRecord(fileId),
      }))

      toast({
        title: "Access granted",
        description: `Shared with ${recipientAddress}`,
      })
    } catch (error: unknown) {
      console.error("[share-panel] grant access failed", error)
      updateShareState(fileId, {
        isProcessing: false,
        status: "Grant failed",
        error: getErrorMessage(error),
      })
      toast({
        title: "Grant failed",
        description: getErrorMessage(error),
      })
    }
  }

  const handleRevokeAccess = async (fileId: string) => {
    const shareState = shareStates[fileId] ?? EMPTY_SHARE_FORM
    const recipientAddress = formatAddress(shareState.recipientAddress)

    if (!isConnected || !defaultOwnerAddress) {
      updateShareState(fileId, { error: "Connect your wallet to revoke access." })
      return
    }
    if (!recipientAddress) {
      updateShareState(fileId, { error: "Recipient address is required to revoke access." })
      return
    }

    try {
      updateShareState(fileId, {
        isProcessing: true,
        status: "Submitting revoke transaction",
        error: null,
        success: null,
      })

      const { txHash } = await revokeFileAccess(fileId, recipientAddress)
      updateShareState(fileId, {
        isProcessing: false,
        status: "Access revoked",
        success: {
          type: "revoke",
          txHash,
          timestamp: new Date().toISOString(),
          recipient: recipientAddress,
        },
      })

      recordRevokeEvent({
        fileId,
        recipient: recipientAddress,
        timestamp: new Date().toISOString(),
        txHash,
      })
      setMetadata((prev) => ({
        ...prev,
        [fileId]: getOwnerFileRecord(fileId),
      }))

      toast({
        title: "Access revoked",
        description: `Removed ${recipientAddress}`,
      })
    } catch (error: unknown) {
      console.error("[share-panel] revoke access failed", error)
      updateShareState(fileId, {
        isProcessing: false,
        status: "Revoke failed",
        error: getErrorMessage(error),
      })
      toast({
        title: "Revoke failed",
        description: getErrorMessage(error),
      })
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-800">
              <Share2 className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Share Encrypted Files</h3>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Wrap your file&apos;s AES key with the recipient&apos;s RSA public key and grant on-chain access in one step.
            </p>
          </div>
          <Button variant="outline" type="button" size="sm" onClick={loadOwnerFiles} disabled={loadingFiles}>
            {loadingFiles ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        {!isConnected ? (
          <Alert className="border-sky-200 bg-sky-50 text-sky-900">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>No wallet connected</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <span>Connect your MetaMask wallet as the file owner.</span>
              <Button type="button" size="sm" onClick={handleConnectWallet} disabled={connecting}>
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span className="ml-2">Connect Wallet</span>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {!ownerPrivateKey || !ownerPublicKey ? (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>RSA key pair missing</AlertTitle>
            <AlertDescription>
              Generate and store your RSA key pair in the upload section so you can unwrap and rewrap AES keys for
              recipients.
            </AlertDescription>
          </Alert>
        ) : null}

        {loadError ? (
          <Alert className="border-rose-300 bg-rose-50 text-rose-900">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Unable to load files</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-4">
          {loadingFiles ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Fetching registered files…</span>
            </div>
          ) : null}

          {!loadingFiles && files.length === 0 ? (
            <Card className="border-dashed bg-slate-50 p-5 text-center text-sm text-slate-500">
              No files registered yet. Upload an encrypted file first.
            </Card>
          ) : null}

          {files.map((file) => {
            const shareState = shareStates[file.fileId] ?? EMPTY_SHARE_FORM
            const fileMeta = metadata[file.fileId]
            const recipients = fileMeta ? Object.values(fileMeta.recipients ?? {}) : []
            return (
              <Card key={file.fileId} className="space-y-4 border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-800">
                      <Lock className="h-4 w-4" />
                      <h4 className="font-medium">File ID</h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="block truncate text-xs text-slate-600">{file.fileId}</code>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          void navigator.clipboard.writeText(file.fileId)
                          toast({ title: "Copied", description: "File ID copied to clipboard." })
                        }}
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </Button>
                    </div>
                    {file.cid ? (
                      <p className="text-xs text-slate-500">
                        CID: <code className="break-all text-slate-600">{file.cid}</code>
                      </p>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500">
                    <span>Status: {shareState.status}</span>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="grid gap-2 md:grid-cols-2 md:items-center md:gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor={`recipient-${file.fileId}`}>Recipient wallet address</Label>
                      <Input
                        id={`recipient-${file.fileId}`}
                        placeholder="0x..."
                        value={shareState.recipientAddress}
                        onChange={handleShareInputChange(file.fileId, "recipientAddress")}
                        disabled={shareState.isProcessing}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`note-${file.fileId}`}>Optional note</Label>
                      <Input
                        id={`note-${file.fileId}`}
                        placeholder="Shared via LAN demo"
                        value={shareState.note}
                        onChange={handleShareInputChange(file.fileId, "note")}
                        disabled={shareState.isProcessing}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`pubkey-${file.fileId}`}>Recipient RSA public key (PEM)</Label>
                    <Textarea
                      id={`pubkey-${file.fileId}`}
                      rows={5}
                      placeholder="-----BEGIN PUBLIC KEY-----"
                      value={shareState.recipientPublicKey}
                      onChange={handleShareInputChange(file.fileId, "recipientPublicKey")}
                      disabled={shareState.isProcessing}
                      className="font-mono text-xs"
                    />
                  </div>

                  {shareState.error ? (
                    <p className="text-sm text-red-600">{shareState.error}</p>
                  ) : null}

                  {shareState.success ? (
                    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>
                        {shareState.success.type === "share" ? "Access granted" : "Access revoked"} for
                        {" "}
                        <code>{shareState.success.recipient}</code>
                      </AlertTitle>
                      <AlertDescription className="text-xs">
                        <p>Timestamp: {shareState.success.timestamp}</p>
                        <p>
                          Tx Hash: <code>{shareState.success.txHash}</code>
                        </p>
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() => handleGrantAccess(file.fileId)}
                      disabled={shareState.isProcessing}
                    >
                      {shareState.isProcessing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Share2 className="mr-2 h-4 w-4" />
                      )}
                      Share Access
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleRevokeAccess(file.fileId)}
                      disabled={shareState.isProcessing}
                    >
                      {shareState.isProcessing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Revoke Access
                    </Button>
                  </div>

                  {recipients.length ? (
                    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      <p className="mb-2 font-semibold text-slate-700">Recipient history</p>
                      <div className="grid gap-2">
                        {recipients
                          .sort((a, b) => b.sharedAt.localeCompare(a.sharedAt))
                          .map((recipient) => (
                            <div
                              key={recipient.address}
                              className="rounded border border-slate-200 bg-white p-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <code className="text-xs">{recipient.address}</code>
                                <span
                                  className={
                                    recipient.status === "granted"
                                      ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                                      : "rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700"
                                  }
                                >
                                  {recipient.status === "granted" ? "Granted" : "Revoked"}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-slate-500">Shared at {recipient.sharedAt}</p>
                              {recipient.status === "revoked" ? (
                                <p className="text-[11px] text-slate-500">Revoked at {recipient.revokedAt}</p>
                              ) : null}
                              {recipient.note ? <p className="mt-1 text-[11px]">Note: {recipient.note}</p> : null}
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => applyRecipientFromHistory(file.fileId, recipient.address, recipient.note)}
                                >
                                  Reuse details
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}

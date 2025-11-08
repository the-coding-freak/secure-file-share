"use client"

import type { ChangeEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useWallet } from "@/hooks/use-wallet"
import { decryptData, unwrapAesKeyWithRsa } from "@/lib/crypto"
import { RSA_PRIVATE_KEY_STORAGE_KEY } from "@/lib/key-storage"
import { getCidForCurrentAccount, getEncryptedKeyForCurrentAccount, hasUserAccess } from "@/lib/contract"
import { retrieveFromPinata } from "@/lib/ipfs"
import { getConnectedAddress } from "@/lib/wallet"
import { CheckCircle2, Download, FileQuestion, Loader2, ShieldAlert, Wallet } from "lucide-react"

interface DownloadResult {
  cid: string
  downloadUrl: string
  filename: string
  mimeType: string
  sizeBytes: number
  sharedBy?: string
  sharedAt?: string
  note?: string
}

interface StatusState {
  step: string
  error: string | null
}

function base64ToUint8Array(base64: string): Uint8Array {
  const cleaned = base64.replace(/\s+/g, "")
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(cleaned, "base64")
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  }
  if (typeof atob !== "function") {
    throw new Error("Base64 decoding not available in this environment")
  }
  const binary = atob(cleaned)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function DownloadPanel() {
  const { address, isConnected, connect, connecting } = useWallet()
  const [fileId, setFileId] = useState("")
  const [privateKey, setPrivateKey] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusState>({ step: "Idle", error: null })
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<DownloadResult | null>(null)
  const [rawPayload, setRawPayload] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    setPrivateKey(window.localStorage.getItem(RSA_PRIVATE_KEY_STORAGE_KEY))
  }, [])

  useEffect(() => {
    return () => {
      if (result?.downloadUrl) {
        URL.revokeObjectURL(result.downloadUrl)
      }
    }
  }, [result?.downloadUrl])

  const activeAccount = useMemo(() => address ?? getConnectedAddress(), [address])

  const handleConnectWallet = async () => {
    try {
      setStatus({ step: "Connecting wallet", error: null })
      await connect()
      setStatus({ step: "Idle", error: null })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Wallet connection failed"
      setStatus({ step: "Wallet error", error: message })
    }
  }

  const handleFileIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFileId(event.target.value)
    setResult(null)
    setRawPayload(null)
    setStatus({ step: "Idle", error: null })
  }

  const resetResult = () => {
    if (result?.downloadUrl) {
      URL.revokeObjectURL(result.downloadUrl)
    }
    setResult(null)
    setRawPayload(null)
  }

  const handleDownload = async () => {
    const trimmedId = fileId.trim()
    if (!trimmedId) {
      setStatus({ step: "", error: "File ID is required." })
      return
    }
    if (!isConnected || !activeAccount) {
      setStatus({ step: "", error: "Connect your wallet to fetch encrypted data." })
      return
    }
    if (!privateKey) {
      setStatus({ step: "", error: "Recipient RSA private key not found. Generate/import it before downloading." })
      return
    }

    setIsProcessing(true)
    resetResult()

    try {
      setStatus({ step: "Checking access", error: null })
      const canAccess = await hasUserAccess(trimmedId, activeAccount)
      if (!canAccess) {
        setStatus({ step: "Access denied", error: "Access not granted or has been revoked for this wallet." })
        setIsProcessing(false)
        return
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to verify access permissions."
      setStatus({ step: "Access check failed", error: message })
      setIsProcessing(false)
      return
    }

    setStatus({ step: "Fetching metadata", error: null })

    try {
      const [cid, encryptedKeyPayload] = await Promise.all([
        getCidForCurrentAccount(trimmedId),
        getEncryptedKeyForCurrentAccount(trimmedId),
      ])

      if (!encryptedKeyPayload) {
        throw new Error("No encryption payload found for this file and account.")
      }

      let parsed: any
      try {
        parsed = JSON.parse(encryptedKeyPayload)
      } catch (error) {
        throw new Error("Stored encryption payload is not valid JSON.")
      }

      if (typeof parsed?.wrappedKey !== "string" || typeof parsed?.iv !== "string") {
        throw new Error("Encryption payload missing wrapped key or IV.")
      }

      setStatus({ step: "Unwrapping AES key", error: null })
      const aesKeyBase64 = await unwrapAesKeyWithRsa(privateKey, parsed.wrappedKey)

      setStatus({ step: "Downloading encrypted file", error: null })
      const encryptedBlob = await retrieveFromPinata(cid)
      const ciphertext = await encryptedBlob.text()

      setStatus({ step: "Decrypting", error: null })
      const decryptedBase64 = await decryptData(ciphertext, aesKeyBase64, parsed.iv)
      const fileBytes = base64ToUint8Array(decryptedBase64)

      setStatus({ step: "Preparing download", error: null })
      const mimeType = typeof parsed?.mimeType === "string" && parsed.mimeType.length ? parsed.mimeType : "application/octet-stream"
      const filename = typeof parsed?.originalName === "string" && parsed.originalName.length ? parsed.originalName : `${fileId.trim()}.bin`
  const arrayBuffer = new ArrayBuffer(fileBytes.byteLength)
  new Uint8Array(arrayBuffer).set(fileBytes)
  const blob = new Blob([arrayBuffer], { type: mimeType })
      const downloadUrl = URL.createObjectURL(blob)

      setResult({
        cid,
        downloadUrl,
        filename,
        mimeType,
        sizeBytes: fileBytes.length,
        sharedBy: typeof parsed?.sharedBy === "string" ? parsed.sharedBy : undefined,
        sharedAt: typeof parsed?.sharedAt === "string" ? parsed.sharedAt : undefined,
        note: typeof parsed?.note === "string" && parsed.note.length ? parsed.note : undefined,
      })
      setRawPayload(JSON.stringify(parsed, null, 2))
      setStatus({ step: "Ready to download", error: null })
    } catch (error: unknown) {
      let message = error instanceof Error ? error.message : "Download failed"
      if (error instanceof Error && /execution reverted/i.test(error.message)) {
        message = "Smart contract denied access. Your access may have been revoked or never granted."
      }
      console.error("[download-panel] Failed to download", error)
      setStatus({ step: "Failed", error: message })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-800">
              <Download className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Download & Decrypt</h3>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Fetch the encrypted CID with your wallet, unwrap the shared AES key using your RSA private key, and recover the original file.
            </p>
          </div>
          <Button variant="outline" type="button" size="sm" onClick={handleDownload} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="ml-2">Decrypt now</span>
          </Button>
        </div>

        {!isConnected ? (
          <Alert className="border-sky-200 bg-sky-50 text-sky-900">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>No wallet connected</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <span>Connect as the recipient to prove access on-chain.</span>
              <Button type="button" size="sm" onClick={handleConnectWallet} disabled={connecting}>
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                <span className="ml-2">Connect Wallet</span>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {!privateKey ? (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>RSA private key missing</AlertTitle>
            <AlertDescription>
              Generate or import your RSA key pair (same storage as the upload panel) before attempting to decrypt shared files.
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="space-y-3 border border-slate-200 p-5">
          <div className="grid gap-2">
            <Label htmlFor="download-file-id">Shared file ID</Label>
            <Input
              id="download-file-id"
              placeholder="0x..."
              value={fileId}
              onChange={handleFileIdChange}
              disabled={isProcessing}
            />
          </div>

          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p>Wallet: {activeAccount ?? "Not connected"}</p>
            <p>Status: {status.step}</p>
            {status.error ? <p className="text-red-600">{status.error}</p> : null}
          </div>

          {result ? (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Decryption ready</AlertTitle>
              <AlertDescription className="space-y-2 text-xs">
                <p>
                  File: <strong>{result.filename}</strong> ({(result.sizeBytes / 1024).toFixed(1)} KB)
                </p>
                <p>
                  CID: <code>{result.cid}</code>
                </p>
                {result.sharedBy ? (
                  <p>
                    Shared by: <code>{result.sharedBy}</code>
                  </p>
                ) : null}
                {result.sharedAt ? <p>Shared at: {result.sharedAt}</p> : null}
                {result.note ? <p>Note: {result.note}</p> : null}
                <Button asChild type="button" className="mt-2">
                  <a href={result.downloadUrl} download={result.filename}>
                    <Download className="mr-2 h-4 w-4" /> Save decrypted file
                  </a>
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {rawPayload ? (
            <div className="grid gap-2">
              <Label>Shared payload (debug)</Label>
              <Textarea value={rawPayload} readOnly rows={8} className="font-mono text-xs" />
            </div>
          ) : null}
        </Card>

        {!result && !isProcessing ? (
          <Card className="border-dashed bg-slate-50 p-5 text-center text-sm text-slate-500">
            <FileQuestion className="mx-auto mb-2 h-5 w-5" />
            Enter a file ID shared with you to retrieve and decrypt the content.
          </Card>
        ) : null}
      </section>
    </div>
  )
}

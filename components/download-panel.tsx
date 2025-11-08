"use client"

import type { ChangeEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/hooks/use-wallet"
import { decryptData, unwrapAesKeyWithRsa } from "@/lib/crypto"
import { RSA_PRIVATE_KEY_STORAGE_KEY } from "@/lib/key-storage"
import { getCidForCurrentAccount, getEncryptedKeyForCurrentAccount, hasUserAccess } from "@/lib/contract"
import { retrieveFromPinata } from "@/lib/ipfs"
import { getConnectedAddress } from "@/lib/wallet"
import { CheckCircle2, Copy, Download, FileQuestion, Loader2, ShieldAlert, Wallet } from "lucide-react"

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

const LAST_FILE_ID_KEY = "secure-share:last-file-id"
const CACHE_OPT_IN_KEY = "secure-share:remember-download"

export function DownloadPanel() {
  const { address, isConnected, connect, connecting } = useWallet()
  const { toast } = useToast()
  const [fileId, setFileId] = useState("")
  const [privateKey, setPrivateKey] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusState>({ step: "Idle", error: null })
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<DownloadResult | null>(null)
  const [privateKeyDraft, setPrivateKeyDraft] = useState("")
  const [rememberFileId, setRememberFileId] = useState(true)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const storedPrivateKey = window.localStorage.getItem(RSA_PRIVATE_KEY_STORAGE_KEY)
    if (storedPrivateKey) {
      setPrivateKey(storedPrivateKey)
      setPrivateKeyDraft(storedPrivateKey)
    }
    const remembered = window.localStorage.getItem(CACHE_OPT_IN_KEY)
    if (remembered === "false") {
      setRememberFileId(false)
    }
    const lastId = window.localStorage.getItem(LAST_FILE_ID_KEY)
    if (lastId) {
      setFileId(lastId)
    }
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
    setStatus({ step: "Idle", error: null })
    setProgress(0)
  }

  const resetResult = () => {
    if (result?.downloadUrl) {
      URL.revokeObjectURL(result.downloadUrl)
    }
    setResult(null)
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
      setProgress(10)
      const canAccess = await hasUserAccess(trimmedId, activeAccount)
      if (!canAccess) {
        setStatus({ step: "Access denied", error: "Access not granted or has been revoked for this wallet." })
        setProgress(0)
        setIsProcessing(false)
        return
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to verify access permissions."
      setStatus({ step: "Access check failed", error: message })
      setProgress(0)
      setIsProcessing(false)
      return
    }

    setStatus({ step: "Fetching metadata", error: null })
    setProgress(25)

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
      setProgress(45)
      const aesKeyBase64 = await unwrapAesKeyWithRsa(privateKey, parsed.wrappedKey)

      setStatus({ step: "Downloading encrypted file", error: null })
      setProgress(65)
      const encryptedBlob = await retrieveFromPinata(cid)
  const ciphertext = await encryptedBlob.text()

      setStatus({ step: "Decrypting", error: null })
      setProgress(85)
      const decryptedBase64 = await decryptData(ciphertext, aesKeyBase64, parsed.iv)
      const fileBytes = base64ToUint8Array(decryptedBase64)

      setStatus({ step: "Preparing download", error: null })
      setProgress(95)
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
      setStatus({ step: "Ready to download", error: null })
      setProgress(100)
      toast({ title: "Decryption ready", description: `Recovered ${filename}` })
    } catch (error: unknown) {
      let message = error instanceof Error ? error.message : "Download failed"
      if (error instanceof Error && /execution reverted/i.test(error.message)) {
        message = "Smart contract denied access. Your access may have been revoked or never granted."
      }
      console.error("[download-panel] Failed to download", error)
      setStatus({ step: "Failed", error: message })
      setProgress(0)
      toast({ title: "Download failed", description: message })
    } finally {
      setIsProcessing(false)
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    if (rememberFileId) {
      if (fileId.trim()) {
        window.localStorage.setItem(LAST_FILE_ID_KEY, fileId.trim())
      }
      window.localStorage.setItem(CACHE_OPT_IN_KEY, "true")
    } else {
      window.localStorage.setItem(CACHE_OPT_IN_KEY, "false")
      window.localStorage.removeItem(LAST_FILE_ID_KEY)
    }
  }, [fileId, rememberFileId])

  const handleSavePrivateKey = () => {
    if (!privateKeyDraft.trim()) {
      toast({ title: "No private key", description: "Paste your RSA private key before saving." })
      return
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RSA_PRIVATE_KEY_STORAGE_KEY, privateKeyDraft.trim())
    }
    setPrivateKey(privateKeyDraft.trim())
    toast({ title: "Private key saved", description: "RSA private key stored locally." })
  }

  const handleClearPrivateKey = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RSA_PRIVATE_KEY_STORAGE_KEY)
    }
    setPrivateKey(null)
    setPrivateKeyDraft("")
    toast({ title: "Private key removed", description: "Private key cleared from local storage." })
  }

  const handleCopyPrivateKey = () => {
    if (!privateKey) {
      toast({ title: "No private key", description: "Generate or import a key first." })
      return
    }
    void navigator.clipboard.writeText(privateKey)
    toast({ title: "Copied", description: "Private key copied to clipboard." })
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
          <div className="grid gap-2 rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <p className="font-medium text-slate-700">RSA private key</p>
            <Textarea
              rows={4}
              placeholder="-----BEGIN PRIVATE KEY-----"
              value={privateKeyDraft}
              onChange={(event) => setPrivateKeyDraft(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={handleSavePrivateKey}>
                Save key
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleCopyPrivateKey}>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleClearPrivateKey}>
                Clear
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="space-y-4">
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
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Switch
                  id="remember-file-id"
                  checked={rememberFileId}
                  onCheckedChange={(checked) => setRememberFileId(Boolean(checked))}
                />
                <Label htmlFor="remember-file-id" className="cursor-pointer text-xs text-slate-500">
                  Remember last file ID on this device
                </Label>
              </div>
              <p className="text-xs text-slate-500">
                Paste the identifier shared with you after access was granted. We will verify permissions on-chain before
                decrypting the content locally.
              </p>
            </div>
            <div className="space-y-3 rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-700">Progress</p>
                <Badge variant={status.error ? "destructive" : "secondary"}>{status.step || (status.error ? "Error" : "Idle")}</Badge>
              </div>
              <p className="text-xs text-slate-500 break-all">Wallet: {activeAccount ?? "Not connected"}</p>
              {status.error ? <p className="text-sm text-red-600">{status.error}</p> : null}
              <Progress value={progress} aria-label="Download progress" />
            </div>
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

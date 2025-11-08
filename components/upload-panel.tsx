"use client"

import type { ChangeEvent } from "react"
import { useEffect, useRef, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/hooks/use-wallet"
import { createFileId, registerFileOnChain } from "@/lib/contract"
import { generateEncryptionKey, generateIV, generateRsaKeyPair, encryptData, wrapAesKeyWithRsa } from "@/lib/crypto"
import { RSA_PRIVATE_KEY_STORAGE_KEY, RSA_PUBLIC_KEY_STORAGE_KEY } from "@/lib/key-storage"
import { uploadToPinata } from "@/lib/ipfs"
import { upsertOwnerFileRecord } from "@/lib/owner-files"
import { getConnectedAddress } from "@/lib/wallet"
import { CheckCircle2, Copy, FileLock2, Key, Loader2, ShieldAlert, Upload } from "lucide-react"

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export function UploadPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { address, isConnected, connect, connecting } = useWallet()
  const { toast } = useToast()

  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [privateKey, setPrivateKey] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState("Idle")
  const [error, setError] = useState<string | null>(null)
  const [generatingKeys, setGeneratingKeys] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<{
    cid: string
    fileId: string
    txHash: string
    timestamp: string
  } | null>(null)
  const [showKeyMaterial, setShowKeyMaterial] = useState(false)
  const [progress, setProgress] = useState(0)

  const setStep = (label: string, progressValue: number) => {
    setStatus(label)
    setProgress(progressValue)
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const storedPublic = window.localStorage.getItem(RSA_PUBLIC_KEY_STORAGE_KEY)
    const storedPrivate = window.localStorage.getItem(RSA_PRIVATE_KEY_STORAGE_KEY)
    if (storedPublic) {
      setPublicKey(storedPublic)
    }
    if (storedPrivate) {
      setPrivateKey(storedPrivate)
    }
  }, [])

  const handleGenerateKeys = async () => {
    try {
      setGeneratingKeys(true)
      setError(null)
      const pair = await generateRsaKeyPair()
      if (typeof window !== "undefined") {
        window.localStorage.setItem(RSA_PUBLIC_KEY_STORAGE_KEY, pair.publicKey)
        window.localStorage.setItem(RSA_PRIVATE_KEY_STORAGE_KEY, pair.privateKey)
      }
      setPublicKey(pair.publicKey)
      setPrivateKey(pair.privateKey)
    } catch (err: unknown) {
      console.error("[upload-panel] RSA generation failed", err)
      setError(err instanceof Error ? err.message : "Failed to generate RSA key pair")
    } finally {
      setGeneratingKeys(false)
    }
  }

  const handleClearKeys = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RSA_PUBLIC_KEY_STORAGE_KEY)
      window.localStorage.removeItem(RSA_PRIVATE_KEY_STORAGE_KEY)
    }
    setPublicKey(null)
    setPrivateKey(null)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setResult(null)
    setProgress(0)
    const nextFile = event.target.files?.[0]
    setFile(nextFile ?? null)
  }

  const handleConnectWallet = async () => {
    try {
      setError(null)
      await connect()
    } catch (err: unknown) {
      console.error("[upload-panel] Wallet connect failed", err)
      setError(err instanceof Error ? err.message : "Wallet connection failed")
    }
  }

  const handleUpload = async () => {
    if (!isConnected || !address) {
      setError("Connect your wallet before uploading.")
      return
    }

    if (!publicKey || !privateKey) {
      setError("Generate and store your RSA key pair before uploading.")
      return
    }

    if (!file) {
      setError("Select a file to upload.")
      return
    }

    try {
      setIsUploading(true)
      setError(null)
      setResult(null)
      setStep("Reading file", 10)
      const fileBuffer = await file.arrayBuffer()
      const base64Payload = arrayBufferToBase64(fileBuffer)

      setStep("Encrypting with AES-256-GCM", 30)
      const aesKey = generateEncryptionKey()
      const iv = generateIV()
      const ciphertext = await encryptData(base64Payload, aesKey, iv)

      setStep("Uploading encrypted blob to Pinata", 55)
      const blob = new Blob([ciphertext], { type: "text/plain" })
      const filename = `${file.name}.enc`
      const cid = await uploadToPinata(blob, filename)

      setStep("Wrapping AES key with RSA-OAEP", 70)
      const wrappedKey = await wrapAesKeyWithRsa(publicKey, aesKey)

      const fileId = createFileId()
      const ownerEncryptedKey = JSON.stringify({
        version: 1,
        iv,
        wrappedKey,
        mimeType: file.type || "application/octet-stream",
        originalName: file.name,
        originalSize: file.size,
      })

      setStep("Registering file on the smart contract", 85)
      const { txHash } = await registerFileOnChain(fileId, cid, ownerEncryptedKey)

      const uploadResult = {
        cid,
        fileId,
        txHash,
        timestamp: new Date().toISOString(),
      }
      setResult(uploadResult)
      setStep("Upload complete", 100)

      upsertOwnerFileRecord({
        fileId,
        cid,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        registeredAt: uploadResult.timestamp,
        txHash,
      })

      toast({
        title: "File uploaded",
        description: `CID ${cid.substring(0, 10)}… registered on-chain`,
      })

      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (err: unknown) {
      console.error("[upload-panel] Upload failed", err)
      setStep("Upload failed", progress)
      setResult(null)
      setError(err instanceof Error ? err.message : "Upload failed")
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unable to complete upload",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const ownerAddress = address ?? getConnectedAddress()

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-800">
              <Key className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Owner RSA Key Pair</h3>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Keys are stored locally in your browser so you can wrap and later unwrap file encryption keys.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" type="button" onClick={handleClearKeys} disabled={generatingKeys}>
              Clear Keys
            </Button>
            <Button size="sm" type="button" onClick={handleGenerateKeys} disabled={generatingKeys}>
              {generatingKeys ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}Generate
            </Button>
          </div>
        </div>

        {!publicKey || !privateKey ? (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>RSA key pair missing</AlertTitle>
            <AlertDescription>
              Generate keys before uploading files. The private key never leaves your browser — keep it safe so you can
              decrypt your content later.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Key material stored locally</AlertTitle>
            <AlertDescription>
              <p>Your RSA keys are ready. Toggle the details if you need to export a backup.</p>
              <Button
                variant="link"
                type="button"
                className="px-0"
                onClick={() => setShowKeyMaterial((prev) => !prev)}
              >
                {showKeyMaterial ? "Hide key PEM" : "Show key PEM"}
              </Button>
              {showKeyMaterial ? (
                <div className="mt-3 grid gap-3">
                  <div>
                    <Label className="text-xs uppercase text-slate-500">Public Key</Label>
                    <Textarea value={publicKey} readOnly rows={6} className="mt-1 font-mono text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase text-slate-500">Private Key</Label>
                    <Textarea value={privateKey} readOnly rows={8} className="mt-1 font-mono text-xs" />
                  </div>
                </div>
              ) : null}
            </AlertDescription>
          </Alert>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-slate-800">
          <FileLock2 className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Encrypted Upload</h3>
        </div>
        <p className="text-sm text-slate-600">
          Select a file to encrypt locally, upload the ciphertext to Pinata, then register the CID and wrapped key on-chain.
        </p>

        {!isConnected ? (
          <Alert className="border-sky-200 bg-sky-50 text-sky-900">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>No wallet connected</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <span>Connect your MetaMask wallet to continue.</span>
              <Button type="button" size="sm" onClick={handleConnectWallet} disabled={connecting}>
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span className="ml-2">Connect Wallet</span>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="fileInput">Choose File</Label>
            <Input ref={fileInputRef} id="fileInput" type="file" onChange={handleFileChange} disabled={isUploading} />
            {file ? (
              <p className="text-xs text-slate-500">
                Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
              </p>
            ) : null}
          </div>

          <div className="grid gap-2 rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="flex items-center gap-2 font-medium text-slate-700">
              <Upload className="h-4 w-4" />
              <span>Upload Status</span>
            </div>
            <Progress value={progress} aria-label="Upload progress" />
            <p>{status}</p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="flex gap-3">
            <Button type="button" onClick={handleUpload} disabled={isUploading || !file || !publicKey || !privateKey || !isConnected}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {isUploading ? "Uploading" : "Encrypt & Upload"}
            </Button>
            {result ? (
              <div className="flex flex-col justify-center text-xs text-slate-500">
                <span>File ID: <code>{result.fileId.slice(0, 10)}…</code></span>
                <span>CID: <code>{result.cid}</code></span>
                <span>Tx Hash: <code>{result.txHash.slice(0, 12)}…</code></span>
              </div>
            ) : null}
          </div>
        </div>

        {result ? (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Upload registered successfully</AlertTitle>
            <AlertDescription className="space-y-2 text-xs">
              <p>Timestamp: {result.timestamp}</p>
              <p>
                File ID: <code>{result.fileId}</code>
              </p>
              <p>
                CID: <code>{result.cid}</code>
              </p>
              <p>
                Transaction Hash: <code>{result.txHash}</code>
              </p>
              {ownerAddress ? (
                <p>
                  Owner Address: <code>{ownerAddress}</code>
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(result.fileId)
                    toast({ title: "Copied", description: "File ID copied to clipboard." })
                  }}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy File ID
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(result.cid)
                    toast({ title: "Copied", description: "CID copied to clipboard." })
                  }}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy CID
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}
      </section>
    </div>
  )
}

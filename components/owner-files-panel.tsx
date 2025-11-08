"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/hooks/use-wallet"
import { getCidForCurrentAccount, getOwnerFileIds } from "@/lib/contract"
import { getOwnerFileRecord, getOwnerFileRecords, type OwnerFileRecord } from "@/lib/owner-files"
import { getConnectedAddress } from "@/lib/wallet"
import { ExternalLink, FileText, Loader2, RefreshCw } from "lucide-react"

interface OwnerFileItem {
  fileId: string
  cid: string
  metadata?: OwnerFileRecord
  source: "local" | "chain"
}

const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/"

export function OwnerFilesPanel() {
  const { address, isConnected, connect, connecting } = useWallet()
  const { toast } = useToast()
  const [items, setItems] = useState<OwnerFileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const ownerAddress = useMemo(() => address ?? getConnectedAddress(), [address])

  const buildLocalItems = () => {
    const records = getOwnerFileRecords()
    return records
      .map<OwnerFileItem>((record) => ({
        fileId: record.fileId,
        cid: record.cid ?? "",
        metadata: record,
        source: "local",
      }))
      .sort((a, b) => {
        const aDate = a.metadata?.registeredAt ?? ""
        const bDate = b.metadata?.registeredAt ?? ""
        return bDate.localeCompare(aDate)
      })
  }

  useEffect(() => {
    setItems(buildLocalItems())
  }, [])

  const loadFiles = async () => {
    if (!ownerAddress) {
      setItems(buildLocalItems())
      return
    }
    try {
      setLoading(true)
      setError(null)
      const chainIds = await getOwnerFileIds(ownerAddress)
      const localRecords = getOwnerFileRecords().reduce<Record<string, OwnerFileRecord>>((acc, record) => {
        acc[record.fileId] = record
        return acc
      }, {})

      const remainingLocal = new Map(Object.entries(localRecords))
      const results: OwnerFileItem[] = []
      for (const id of chainIds) {
        try {
          const cid = await getCidForCurrentAccount(id)
          const metadata = localRecords[id] ?? getOwnerFileRecord(id)
          results.push({ fileId: id, cid, metadata, source: "chain" })
          remainingLocal.delete(id)
        } catch (err) {
          console.error("[owner-files] Failed to load CID", id, err)
          const metadata = localRecords[id] ?? getOwnerFileRecord(id)
          results.push({ fileId: id, cid: "", metadata, source: "chain" })
          remainingLocal.delete(id)
        }
      }
      const localOnly = Array.from(remainingLocal.values()).map<OwnerFileItem>((record) => ({
        fileId: record.fileId,
        cid: record.cid ?? "",
        metadata: record,
        source: "local",
      }))
      const merged = [...results, ...localOnly].sort((a, b) => {
        const aDate = a.metadata?.registeredAt ?? ""
        const bDate = b.metadata?.registeredAt ?? ""
        return bDate.localeCompare(aDate)
      })
      setItems(merged.length ? merged : buildLocalItems())
      setLastSyncedAt(new Date().toISOString())
    } catch (err) {
      console.error("[owner-files] Failed to load files", err)
      setError(err instanceof Error ? err.message : "Unable to load files")
      setItems(buildLocalItems())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isConnected && ownerAddress) {
      void loadFiles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, ownerAddress])

  const handleConnect = async () => {
    try {
      await connect()
    } catch (err) {
      toast({ title: "Wallet error", description: err instanceof Error ? err.message : "Could not connect wallet" })
    }
  }

  const handleOpenSharePanel = () => {
    router.push("/share")
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Registered Files</h3>
          <p className="text-sm text-slate-600">Review your on-chain records and jump back into sharing when needed.</p>
          {lastSyncedAt ? (
            <p className="mt-1 text-xs text-slate-400">Last synced {new Date(lastSyncedAt).toLocaleString()}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleOpenSharePanel}>
            Go to Share
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={loadFiles} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {!isConnected ? (
        <Alert className="border-sky-200 bg-sky-50 text-sky-900">
          <AlertTitle>Connect wallet to view files</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span>Use the owner wallet to load your registered files.</span>
            <Button type="button" size="sm" onClick={handleConnect} disabled={connecting}>
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className="ml-2">Connect Wallet</span>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert className="border-rose-300 bg-rose-50 text-rose-900">
          <AlertTitle>Unable to load files</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading files…
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <Card className="border-dashed bg-slate-50 p-5 text-center text-sm text-slate-500">
          No uploads recorded on this device yet. Encrypt and register a file from the upload page to see it here.
        </Card>
      ) : null}

      <div className="grid gap-4">
        {items.map((item) => {
          const meta = item.metadata
          const recipientList = meta ? Object.values(meta.recipients ?? {}) : []
          return (
            <Card key={item.fileId} className="space-y-3 border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-800">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">{meta?.filename ?? "Registered file"}</span>
                  </div>
                  <code className="block break-words text-xs text-slate-600">{item.fileId}</code>
                  {meta ? (
                    <p className="text-[11px] text-slate-500">
                      Registered at {meta.registeredAt} · {(meta.size / 1024).toFixed(1)} KB
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={item.source === "chain" ? "secondary" : "outline"}
                    className={item.source === "chain" ? "bg-emerald-100 text-emerald-700" : "text-slate-500"}
                  >
                    {item.source === "chain" ? "On-chain verified" : "Local only"}
                  </Badge>
                  {item.cid ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(item.cid)
                        toast({ title: "Copied", description: "CID copied to clipboard." })
                      }}
                    >
                      Copy CID
                    </Button>
                  ) : null}
                  {item.cid ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`${PINATA_GATEWAY}${item.cid}`, "_blank")}
                    >
                      <ExternalLink className="mr-2 h-3 w-3" />
                      View CID
                    </Button>
                  ) : null}
                </div>
              </div>

              {item.cid ? (
                <p className="text-xs text-slate-500">
                  CID: <code className="break-all text-slate-600">{item.cid}</code>
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  CID unavailable{item.source === "chain" ? " (requires owner access)" : " until the file is registered on-chain"}
                </p>
              )}

              {recipientList.length ? (
                <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="mb-2 font-semibold text-slate-700">Recent recipients</p>
                  <div className="grid gap-2">
                    {recipientList
                      .sort((a, b) => b.sharedAt.localeCompare(a.sharedAt))
                      .map((recipient) => (
                        <div key={recipient.address} className="rounded border border-slate-200 bg-white p-2">
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
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No share history stored locally yet.</p>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

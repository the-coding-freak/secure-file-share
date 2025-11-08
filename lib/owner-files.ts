const STORAGE_KEY = "secure-share:owner-files"

interface RecipientStatusBase {
  address: string
  sharedAt: string
  note?: string
  shareTxHash: string
}

export type RecipientStatus =
  | (RecipientStatusBase & {
      status: "granted"
    })
  | (RecipientStatusBase & {
      status: "revoked"
      revokedAt: string
      revokeTxHash: string
    })

export interface OwnerFileRecord {
  fileId: string
  cid: string
  filename: string
  mimeType: string
  size: number
  registeredAt: string
  txHash?: string
  recipients: Record<string, RecipientStatus>
  lastSharedAt?: string
  lastSharedRecipient?: string
  note?: string
}

type OwnerFileStore = Record<string, OwnerFileRecord>

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function loadStore(): OwnerFileStore {
  if (!isBrowser()) return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as OwnerFileStore
  } catch (error) {
    console.warn("[owner-files] Failed to parse store", error)
    return {}
  }
}

function saveStore(store: OwnerFileStore): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch (error) {
    console.warn("[owner-files] Failed to persist store", error)
  }
}

export function getOwnerFileRecords(): OwnerFileRecord[] {
  const store = loadStore()
  return Object.values(store).sort((a, b) => {
    const aTime = a.registeredAt ?? ""
    const bTime = b.registeredAt ?? ""
    return bTime.localeCompare(aTime)
  })
}

export function getOwnerFileRecord(fileId: string): OwnerFileRecord | undefined {
  const store = loadStore()
  return store[fileId]
}

export function upsertOwnerFileRecord(record: {
  fileId: string
  cid: string
  filename: string
  mimeType: string
  size: number
  registeredAt: string
  txHash?: string
}): void {
  const store = loadStore()
  const existing = store[record.fileId]
  store[record.fileId] = {
    fileId: record.fileId,
    cid: record.cid,
    filename: record.filename,
    mimeType: record.mimeType,
    size: record.size,
    registeredAt: record.registeredAt,
    txHash: record.txHash || existing?.txHash,
    recipients: existing?.recipients ?? {},
    lastSharedAt: existing?.lastSharedAt,
    lastSharedRecipient: existing?.lastSharedRecipient,
    note: existing?.note,
  }
  saveStore(store)
}

export function recordShareEvent(params: {
  fileId: string
  recipient: string
  note?: string
  timestamp: string
  txHash: string
}): void {
  const store = loadStore()
  const record = store[params.fileId]
  if (!record) {
    console.warn("[owner-files] Attempted to log share for unknown file", params.fileId)
    return
  }
  record.recipients[params.recipient.toLowerCase()] = {
    address: params.recipient,
    status: "granted",
    sharedAt: params.timestamp,
    note: params.note,
    shareTxHash: params.txHash,
  }
  record.lastSharedAt = params.timestamp
  record.lastSharedRecipient = params.recipient
  saveStore(store)
}

export function recordRevokeEvent(params: {
  fileId: string
  recipient: string
  timestamp: string
  txHash: string
}): void {
  const store = loadStore()
  const record = store[params.fileId]
  if (!record) {
    console.warn("[owner-files] Attempted to log revoke for unknown file", params.fileId)
    return
  }
  const recipientKey = params.recipient.toLowerCase()
  const existing = record.recipients[recipientKey]
  const shareTxHash = existing ? existing.shareTxHash : params.txHash
  const sharedAt = existing ? existing.sharedAt : params.timestamp
  const note = existing?.note
  record.recipients[recipientKey] = {
    address: params.recipient,
    status: "revoked",
    sharedAt,
    note,
    shareTxHash,
    revokedAt: params.timestamp,
    revokeTxHash: params.txHash,
  }
  saveStore(store)
}

export function clearOwnerFiles(): void {
  if (!isBrowser()) return
  window.localStorage.removeItem(STORAGE_KEY)
}

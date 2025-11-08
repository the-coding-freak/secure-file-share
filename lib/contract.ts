import type { AbstractProvider } from "ethers"
import { BrowserProvider, Contract, JsonRpcProvider, hexlify, randomBytes } from "ethers"

const CONTRACT_ABI = [
  "event FileRegistered(bytes32 indexed fileId, address indexed owner, string cid)",
  "event AccessGranted(bytes32 indexed fileId, address indexed owner, address indexed recipient)",
  "event AccessRevoked(bytes32 indexed fileId, address indexed owner, address indexed recipient)",
  "function registerFile(bytes32 fileId, string cid, string ownerEncryptedKey)",
  "function grantAccess(bytes32 fileId, address recipient, string wrappedKey)",
  "function revokeAccess(bytes32 fileId, address recipient)",
  "function getCid(bytes32 fileId) view returns (string)",
  "function getEncryptedKey(bytes32 fileId, address user) view returns (string)",
  "function getOwnerFiles(address owner) view returns (bytes32[])",
  "function hasFileAccess(bytes32 fileId, address user) view returns (bool)",
]

const ENV_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL

export function resolveLocalRpcUrl(): string {
  if (ENV_RPC_URL && ENV_RPC_URL.length > 0) {
    return ENV_RPC_URL
  }

  if (typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:8545`
  }

  return "http://127.0.0.1:8545"
}

let contractAddress: string | null = null
let cachedReadContract: Contract | null = null
let cachedWriteContract: Contract | null = null
let rpcProvider: JsonRpcProvider | null = null

async function getContractAddress(): Promise<string> {
  if (contractAddress !== null) {
    return contractAddress as string
  }

  try {
    const response = await fetch("/deployment.json")
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: deployment.json not found`)
    }
    const data = await response.json()
    if (!data.contractAddress || data.contractAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error("Contract not deployed. Run backend deployment first: npm run backend:deploy")
    }
    if (contractAddress && contractAddress !== data.contractAddress) {
      cachedReadContract = null
      cachedWriteContract = null
    }
    contractAddress = data.contractAddress
    console.log("[v0] Contract address loaded:", contractAddress)
    return contractAddress as string
  } catch (error) {
    console.error("[v0] Failed to load contract address:", error)
    throw error
  }
}

function getRpcProvider(): JsonRpcProvider {
  if (!rpcProvider) {
    rpcProvider = new JsonRpcProvider(resolveLocalRpcUrl())
  }
  return rpcProvider
}

async function ensureContractDeployed(provider: AbstractProvider, address: string): Promise<void> {
  const code = await provider.getCode(address)
  if (!code || code === "0x") {
    cachedReadContract = null
    cachedWriteContract = null
    throw new Error(
      "Smart contract not found on the connected network. Run `npm run backend:deploy` (while the Hardhat node is running) and refresh the app.",
    )
  }
}

async function getReadContract(): Promise<Contract> {
  const address = await getContractAddress()

  if (cachedReadContract) {
    return cachedReadContract
  }

  if (typeof window !== "undefined" && (window as any).ethereum) {
    const provider = new BrowserProvider((window as any).ethereum)
    await ensureContractDeployed(provider, address)
    cachedReadContract = new Contract(address, CONTRACT_ABI, provider)
  } else {
    const provider = getRpcProvider()
    await ensureContractDeployed(provider, address)
    cachedReadContract = new Contract(address, CONTRACT_ABI, provider)
  }

  return cachedReadContract
}

async function getWriteContract(): Promise<Contract> {
  if (cachedWriteContract) {
    return cachedWriteContract
  }

  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("Wallet not connected")
  }

  const address = await getContractAddress()
  const provider = new BrowserProvider((window as any).ethereum)
  await ensureContractDeployed(provider, address)
  const signer = await provider.getSigner()
  cachedWriteContract = new Contract(address, CONTRACT_ABI, signer)

  if (!cachedWriteContract) {
    throw new Error("Failed to initialize signer contract")
  }

  return cachedWriteContract
}

async function getSignerAddress(contract: Contract): Promise<string> {
  const runner = contract.runner as { getAddress?: () => Promise<string> } | null
  if (!runner?.getAddress) {
    throw new Error("Wallet signer not available")
  }
  return runner.getAddress()
}

export async function isContractDeployed(): Promise<boolean> {
  try {
    const response = await fetch("/deployment.json")
    if (!response.ok) return false
    const data = await response.json()
    return Boolean(data.contractAddress && data.contractAddress !== "0x0000000000000000000000000000000000000000")
  } catch {
    return false
  }
}

export async function initializeContract(): Promise<void> {
  try {
    await getReadContract()
    console.log("[v0] Contract initialized")
  } catch (error) {
    console.error("[v0] Contract initialization failed:", error)
    throw error
  }
}

export function createFileId(): string {
  return hexlify(randomBytes(32))
}

export async function registerFileOnChain(fileId: string, cid: string, ownerEncryptedKey: string): Promise<{ txHash: string }> {
  try {
    const contract = await getWriteContract()
    const tx = await contract.registerFile(fileId, cid, ownerEncryptedKey)
    console.log("[v0] File registered:", tx.hash)
    await tx.wait()
    return { txHash: tx.hash }
  } catch (error) {
    console.error("[v0] registerFile error:", error)
    throw error
  }
}

export async function grantAccessOnChain(fileId: string, recipientAddress: string, wrappedKey: string): Promise<{ txHash: string }> {
  try {
    const contract = await getWriteContract()
    const tx = await contract.grantAccess(fileId, recipientAddress, wrappedKey)
    console.log("[v0] Access granted tx:", tx.hash)
    await tx.wait()
    return { txHash: tx.hash }
  } catch (error) {
    console.error("[v0] grantAccess error:", error)
    throw error
  }
}

export async function revokeFileAccess(fileId: string, recipientAddress: string): Promise<{ txHash: string }> {
  try {
    const contract = await getWriteContract()
    const tx = await contract.revokeAccess(fileId, recipientAddress)
    console.log("[v0] Access revoked tx:", tx.hash)
    await tx.wait()
    return { txHash: tx.hash }
  } catch (error) {
    console.error("[v0] revokeAccess error:", error)
    throw error
  }
}

export async function getOwnerFileIds(ownerAddress: string): Promise<string[]> {
  try {
    const contract = await getReadContract()
    const ids = await contract.getOwnerFiles(ownerAddress)
    return ids.map((id: string) => id)
  } catch (error) {
    console.error("[v0] getOwnerFileIds error:", error)
    throw error
  }
}

export async function getCidForFile(fileId: string): Promise<string> {
  try {
    const contract = await getReadContract()
    return await contract.getCid(fileId)
  } catch (error) {
    console.error("[v0] getCid error:", error)
    throw error
  }
}

export async function getEncryptedKeyForUser(fileId: string, userAddress: string): Promise<string> {
  try {
    const contract = await getReadContract()
    return await contract.getEncryptedKey(fileId, userAddress)
  } catch (error) {
    console.error("[v0] getEncryptedKey error:", error)
    throw error
  }
}

export async function getCidForCurrentAccount(fileId: string): Promise<string> {
  const contract = await getWriteContract()
  try {
    return await contract.getCid(fileId)
  } catch (error) {
    console.error("[v0] getCidForCurrentAccount error:", error)
    throw error
  }
}

export async function getEncryptedKeyForCurrentAccount(fileId: string): Promise<string> {
  const contract = await getWriteContract()
  try {
    const caller = await getSignerAddress(contract)
    return await contract.getEncryptedKey(fileId, caller)
  } catch (error) {
    console.error("[v0] getEncryptedKeyForCurrentAccount error:", error)
    throw error
  }
}

export async function hasUserAccess(fileId: string, userAddress: string): Promise<boolean> {
  try {
    const contract = await getReadContract()
    return await contract.hasFileAccess(fileId, userAddress)
  } catch (error) {
    console.error("[v0] hasUserAccess error:", error)
    throw error
  }
}

// Backwards-compatible helpers retained for older components/tests.
export async function uploadFileToBlockchain(ipfsHash: string, encryptionPayload: string): Promise<{ hash: string; fileId?: string }> {
  const fileId = createFileId()
  const { txHash } = await registerFileOnChain(fileId, ipfsHash, encryptionPayload)
  return { hash: txHash, fileId }
}

export async function shareFileWithUser(fileId: string, recipientAddress: string, wrappedKey: string): Promise<{ hash: string }> {
  const { txHash } = await grantAccessOnChain(fileId, recipientAddress, wrappedKey)
  return { hash: txHash }
}

export async function getUserFilesList(userAddress: string): Promise<string[]> {
  return getOwnerFileIds(userAddress)
}

export async function getFileMetadata(fileId: string, userAddress: string): Promise<{
  cid: string
  encryptedKey: string
}> {
  const cid = await getCidForFile(fileId)
  const encryptedKey = await getEncryptedKeyForUser(fileId, userAddress)
  return { cid, encryptedKey }
}

export function clearCachedContracts(): void {
  cachedReadContract = null
  cachedWriteContract = null
  rpcProvider = null
}

import type { AbstractProvider } from "ethers"
import { BrowserProvider, Contract, JsonRpcProvider } from "ethers"

const CONTRACT_ABI = [
  "event FileUploaded(bytes32 indexed fileId, address indexed owner, string ipfsHash)",
  "event FileShared(bytes32 indexed fileId, address indexed from, address indexed to)",
  "event FileRevoked(bytes32 indexed fileId, address indexed from, address indexed to)",
  "function uploadFile(string ipfsHash, string encryptionKey, bool isPublic) returns (bytes32)",
  "function shareFile(bytes32 fileId, address recipient)",
  "function revokeAccess(bytes32 fileId, address recipient)",
  "function getFileMetadata(bytes32 fileId) view returns (tuple(string ipfsHash, address owner, uint256 timestamp, string encryptionKey, bool isPublic))",
  "function getUserFiles(address user) view returns (bytes32[])",
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

export async function uploadFileToBlockchain(ipfsHash: string, encryptionKey: string, isPublic = false): Promise<{ hash: string; fileId?: string }> {
  try {
    const contract = await getWriteContract()
    const tx = await contract.uploadFile(ipfsHash, encryptionKey, isPublic)
    console.log("[v0] Upload transaction sent:", tx.hash)
    const receipt = await tx.wait()

    let fileId: string | undefined
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log)
        if (parsed?.name === "FileUploaded" && parsed.args?.fileId) {
          fileId = parsed.args.fileId as string
          break
        }
      } catch {
        // ignore non-matching logs
      }
    }

    return { hash: tx.hash, fileId }
  } catch (error) {
    console.error("[v0] Blockchain upload error:", error)
    throw error
  }
}

export async function shareFileWithUser(fileId: string, recipientAddress: string): Promise<{ hash: string }> {
  try {
    const contract = await getWriteContract()
    const tx = await contract.shareFile(fileId, recipientAddress)
    console.log("[v0] Share transaction sent:", tx.hash)
    await tx.wait()
    return { hash: tx.hash }
  } catch (error) {
    console.error("[v0] Share error:", error)
    throw error
  }
}

export async function revokeFileAccess(fileId: string, recipientAddress: string): Promise<{ hash: string }> {
  try {
    const contract = await getWriteContract()
    const tx = await contract.revokeAccess(fileId, recipientAddress)
    console.log("[v0] Revoke transaction sent:", tx.hash)
    await tx.wait()
    return { hash: tx.hash }
  } catch (error) {
    console.error("[v0] Revoke error:", error)
    throw error
  }
}

export async function getFileMetadata(fileId: string): Promise<{
  ipfsHash: string
  owner: string
  timestamp: bigint
  encryptionKey: string
  isPublic: boolean
}> {
  try {
    const contract = await getReadContract()
    const metadata = await contract.getFileMetadata(fileId)
    return {
      ipfsHash: metadata.ipfsHash,
      owner: metadata.owner,
      timestamp: metadata.timestamp,
      encryptionKey: metadata.encryptionKey,
      isPublic: metadata.isPublic,
    }
  } catch (error) {
    console.error("[v0] Metadata fetch error:", error)
    throw error
  }
}

export async function getUserFilesList(userAddress: string): Promise<string[]> {
  try {
    const contract = await getReadContract()
    const files = await contract.getUserFiles(userAddress)
    return files.map((fileId: string) => fileId)
  } catch (error) {
    console.error("[v0] User files fetch error:", error)
    if ((error as any)?.code === "BAD_DATA") {
      throw new Error(
        "Failed to read files from contract. Ensure the Hardhat node is running and the contract is deployed on the current network.",
      )
    }
    throw error
  }
}

export function clearCachedContracts(): void {
  cachedReadContract = null
  cachedWriteContract = null
  rpcProvider = null
}

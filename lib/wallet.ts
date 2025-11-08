import { JsonRpcProvider, parseEther, toQuantity } from "ethers"
import { clearCachedContracts, resolveLocalRpcUrl } from "./contract"

let provider: any = null
let userAddress: string | null = null
let walletChangeListeners: ((connected: boolean) => void)[] = []

function notifyWalletChange(connected: boolean) {
  walletChangeListeners.forEach((listener) => listener(connected))
}

async function ensureHardhatFunds(account: string): Promise<void> {
  try {
    const rpcUrl = resolveLocalRpcUrl()
    const provider = new JsonRpcProvider(rpcUrl)
    const minimumBalance = parseEther("5")
    const currentBalance = await provider.getBalance(account)
    if (currentBalance >= minimumBalance) {
      return
    }

    const targetBalance = parseEther("100")
    await provider.send("hardhat_setBalance", [account, toQuantity(targetBalance)])
    console.log(`[v0] Hardhat balance topped up for ${account}`)
  } catch (error) {
    console.warn("[v0] Unable to top up Hardhat balance:", error)
  }
}

/**
 * Connect to Ethereum wallet (MetaMask or similar)
 */
export async function connectWallet(): Promise<string> {
  try {
    if (typeof window === "undefined") {
      throw new Error("Wallet not available")
    }

    const ethereum = (window as any).ethereum
    if (!ethereum) {
      throw new Error("MetaMask not detected. Please install MetaMask.")
    }

    const accounts = await ethereum.request({ method: "eth_requestAccounts" })
    if (!accounts || accounts.length === 0 || typeof accounts[0] !== "string") {
      throw new Error("No wallet accounts found")
    }

    userAddress = accounts[0]
    provider = ethereum

    console.log("[v0] Wallet connected:", userAddress)
    clearCachedContracts()
    await ensureHardhatFunds(userAddress)
    notifyWalletChange(true)
    return userAddress
  } catch (error) {
    console.error("[v0] Wallet connection error:", error)
    throw error
  }
}

/**
 * Disconnect wallet
 */
export function disconnectWallet(): void {
  provider = null
  userAddress = null
  console.log("[v0] Wallet disconnected")
  clearCachedContracts()
  notifyWalletChange(false)
}

/**
 * Get current connected address
 */
export function getConnectedAddress(): string | null {
  return userAddress
}

/**
 * Get provider
 */
export function getProvider(): any {
  return provider
}

export function subscribeToWalletChanges(callback: (connected: boolean) => void): () => void {
  walletChangeListeners.push(callback)
  // Return unsubscribe function
  return () => {
    walletChangeListeners = walletChangeListeners.filter((listener) => listener !== callback)
  }
}

/**
 * Switch to local network
 */
export async function switchToLocalNetwork(): Promise<void> {
  const rpcUrl = resolveLocalRpcUrl()

  try {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("MetaMask not detected")
    }

    const ethereum = (window as any).ethereum

    // Try to switch to existing network
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x7a69" }], // 31337 in hex
    })
  } catch (error: any) {
    // If network doesn't exist, add it
    if (error.code === 4902) {
      try {
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x7a69",
              chainName: "Hardhat Local",
              rpcUrls: [rpcUrl],
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            },
          ],
        })
      } catch (addError: any) {
        console.error("[v0] Failed to add network:", addError)

        if (typeof addError?.message === "string" && addError.message.includes("HTTPS")) {
          const detail =
            `MetaMask blocked the RPC URL ${rpcUrl}. Enable 'Allow HTTP connections' in MetaMask Advanced Settings or expose the Hardhat node over HTTPS.`
          const wrappedError = new Error(detail)
          ;(wrappedError as any).cause = addError
          throw wrappedError
        }

        throw addError
      }
    } else if (typeof error?.message === "string" && error.message.includes("HTTPS")) {
      const wrappedError = new Error(
        "MetaMask rejected the HTTP RPC endpoint. Enable 'Allow HTTP connections' in MetaMask Advanced Settings or serve the Hardhat node over HTTPS.",
      )
      ;(wrappedError as any).cause = error
      throw wrappedError
    } else {
      throw error
    }
  }
}

/**
 * Send transaction using Web3
 */
export async function sendTransaction(to: string, data: string): Promise<string> {
  if (!userAddress || !provider) {
    throw new Error("Wallet not connected")
  }

  const txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: userAddress,
        to,
        data,
      },
    ],
  })

  return txHash
}

/**
 * Call contract view function
 */
export async function callContractFunction(to: string, data: string): Promise<string> {
  if (!provider) {
    throw new Error("Wallet not connected")
  }

  const result = await provider.request({
    method: "eth_call",
    params: [
      {
        to,
        data,
      },
      "latest",
    ],
  })

  return result
}

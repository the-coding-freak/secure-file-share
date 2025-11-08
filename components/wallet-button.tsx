"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { connectWallet, disconnectWallet, switchToLocalNetwork, subscribeToWalletChanges } from "@/lib/wallet"
import { initializeContract, isContractDeployed } from "@/lib/contract"
import { Wallet } from "lucide-react"
import { useEffect } from "react"

export function WalletButton() {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [contractDeployed, setContractDeployed] = useState(false)

  useEffect(() => {
    isContractDeployed().then(setContractDeployed)

    const unsubscribe = subscribeToWalletChanges((connected) => {
      if (!connected) {
        setAddress(null)
        setIsConnected(false)
      }
    })

    return unsubscribe
  }, [])

  const handleConnect = async () => {
    setIsLoading(true)
    try {
      await switchToLocalNetwork()
      const connectedAddress = await connectWallet()
      console.log("[v0] Wallet connected:", connectedAddress)

      if (contractDeployed) {
        try {
          await initializeContract()
          console.log("[v0] Contract initialized successfully")
        } catch (contractError) {
          console.error("[v0] Contract initialization failed:", contractError)
        }
      }

      setAddress(connectedAddress)
      setIsConnected(true)
    } catch (error) {
      console.error("Connection failed:", error)
      alert("Failed to connect wallet: " + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = () => {
    disconnectWallet()
    setAddress(null)
    setIsConnected(false)
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
        <Button variant="outline" size="sm" onClick={handleDisconnect}>
          Disconnect
        </Button>
      </div>
    )
  }

  return (
    <Button onClick={handleConnect} disabled={isLoading} className="gap-2">
      <Wallet className="w-4 h-4" />
      {isLoading ? "Connecting..." : "Connect Wallet"}
    </Button>
  )
}

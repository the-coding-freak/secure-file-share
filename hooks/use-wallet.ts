"use client"

import { useEffect, useState } from "react"
import { connectWallet, disconnectWallet, subscribeToWalletChanges, switchToLocalNetwork, getConnectedAddress } from "@/lib/wallet"

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    setAddress(getConnectedAddress())
    const unsubscribe = subscribeToWalletChanges((connected) => {
      setAddress(connected ? getConnectedAddress() : null)
    })
    return unsubscribe
  }, [])

  const connect = async () => {
    try {
      setConnecting(true)
      await switchToLocalNetwork()
      const addr = await connectWallet()
      setAddress(addr)
    } catch (error) {
      console.error("Wallet connect failed:", error)
      throw error
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = () => {
    disconnectWallet()
    setAddress(null)
  }

  return {
    address,
    isConnected: Boolean(address),
    connecting,
    connect,
    disconnect,
  }
}

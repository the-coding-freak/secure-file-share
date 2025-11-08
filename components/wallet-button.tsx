"use client"

"use client"

import { Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/hooks/use-wallet"

export function WalletButton() {
  const { address, isConnected, connecting, connect, disconnect } = useWallet()

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <Button variant="outline" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    )
  }

  return (
    <Button onClick={connect} disabled={connecting} className="gap-2">
      <Wallet className="h-4 w-4" />
      {connecting ? "Connecting..." : "Connect Wallet"}
    </Button>
  )
}

"use client"

import { useState, useEffect } from "react"
import { WalletButton } from "@/components/wallet-button"
import { FileUpload } from "@/components/file-upload"
import { FileList } from "@/components/file-list"
import { FileDownload } from "@/components/file-download"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getConnectedAddress, subscribeToWalletChanges } from "@/lib/wallet"
import { isContractDeployed } from "@/lib/contract"
import { AlertCircle } from "lucide-react"

export default function Home() {
  const [isConnected, setIsConnected] = useState(false)
  const [contractDeployed, setContractDeployed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const address = getConnectedAddress()
    setIsConnected(!!address)

    isContractDeployed().then(setContractDeployed)
    setLoading(false)

    const unsubscribe = subscribeToWalletChanges((connected) => {
      setIsConnected(connected)
    })

    const contractPoll = setInterval(() => {
      isContractDeployed().then(setContractDeployed)
    }, 2000)

    return () => {
      unsubscribe?.()
      clearInterval(contractPoll)
    }
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Secure File Sharing</h1>
            <p className="text-gray-600">Blockchain-powered encryption with IPFS storage</p>
          </div>
          <WalletButton />
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="p-4 bg-white">
            <div className="text-sm text-gray-600">Backend</div>
            <div className="text-2xl font-bold text-green-600">✓ L1-L4</div>
          </Card>
          <Card className="p-4 bg-white">
            <div className="text-sm text-gray-600">Frontend</div>
            <div className="text-2xl font-bold text-blue-600">✓ L5-L9</div>
          </Card>
          <Card className="p-4 bg-white">
            <div className="text-sm text-gray-600">Contract</div>
            <div className={`text-2xl font-bold ${contractDeployed ? "text-green-600" : "text-orange-600"}`}>
              {contractDeployed ? "✓ Ready" : "○ Deploy"}
            </div>
          </Card>
        </div>

        {!contractDeployed && (
          <Card className="p-4 mb-8 bg-orange-50 border-orange-200">
            <div className="flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-orange-900">Contract Not Deployed</h3>
                <p className="text-orange-700 text-sm mt-1">
                  Run <code className="bg-orange-100 px-2 py-1 rounded">npm run backend:deploy</code> to deploy the
                  smart contract. Page will auto-update when ready.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Main Content */}
        {!isConnected ? (
          <Card className="p-8 text-center bg-white">
            <h2 className="text-2xl font-semibold mb-4">Connect Your Wallet</h2>
            <p className="text-gray-600 mb-6">Connect your wallet to get started with secure file sharing</p>
            <div className="flex justify-center">
              <WalletButton />
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload Section */}
            <div>
              <FileUpload />
              {!contractDeployed && (
                <Card className="mt-4 p-4 bg-yellow-50 border-yellow-200">
                  <p className="text-sm text-yellow-700">
                    Upload disabled until contract is deployed. Page will auto-enable when ready.
                  </p>
                </Card>
              )}
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="files" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-white mb-4">
                  <TabsTrigger value="files">My Files</TabsTrigger>
                  <TabsTrigger value="download">Download</TabsTrigger>
                </TabsList>

                <TabsContent value="files" className="bg-white rounded-lg p-6">
                  <FileList />
                </TabsContent>

                <TabsContent value="download" className="bg-white rounded-lg p-6">
                  <FileDownload />
                </TabsContent>
              </Tabs>

              {!contractDeployed && (
                <Card className="mt-4 p-4 bg-yellow-50 border-yellow-200">
                  <p className="text-sm text-yellow-700">
                    File operations disabled until contract is deployed. Page will auto-enable when ready.
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Footer Info */}
        <Card className="mt-8 p-4 bg-white text-sm text-gray-600">
          <p>L10: Cross-device LAN testing ready. Run Hardhat local node on http://127.0.0.1:8545</p>
          <p className="mt-2">Setup: npm run backend:node (in new terminal)</p>
        </Card>
      </div>
    </main>
  )
}

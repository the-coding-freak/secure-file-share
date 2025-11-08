import Link from "next/link"
import { ArrowLeft, UploadCloud } from "lucide-react"
import { NavBar } from "@/components/nav-bar"
import { UploadPanel } from "@/components/upload-panel"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Encrypt & Upload | Secure Share",
  description: "Encrypt files locally and register them on-chain before sharing.",
}

export default function UploadPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <NavBar />
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
          <Button asChild variant="ghost" className="w-fit px-0 text-slate-500 hover:text-slate-900">
            <Link href="/" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to overview
            </Link>
          </Button>
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              <UploadCloud className="h-3.5 w-3.5" />
              Step 1
            </div>
            <h1 className="text-3xl font-semibold text-slate-900">Encrypt & Upload</h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Generate your RSA key pair, encrypt files in the browser with AES-256-GCM, and register the ciphertext CID
              with the wrapped key on the local Hardhat network.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <Card className="border border-slate-200 p-6 shadow-sm">
          <UploadPanel />
        </Card>
      </section>
    </main>
  )
}

import { NavBar } from "@/components/nav-bar"
import { SharePanel } from "@/components/share-panel"
import { UploadPanel } from "@/components/upload-panel"
import { DownloadPanel } from "@/components/download-panel"
import { Card } from "@/components/ui/card"

const PLACEHOLDER_SECTIONS = [
  {
    id: "files",
    title: "My Files",
    description: "View files you have registered on the local blockchain.",
    status: "Planned",
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <NavBar />
      <section className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-10 space-y-4 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Secure File Sharing (LAN Demo)
          </h1>
          <p className="mx-auto max-w-2xl text-base text-slate-600">
            AES-256-GCM encryption, RSA-OAEP key wrapping, IPFS storage via Pinata, and a Hardhat smart contract. This
            interface is the staging ground for the upcoming end-to-end workflow.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card id="upload" className="h-full p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-medium text-slate-900">Encrypt & Upload</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Select a file, encrypt it locally, push the ciphertext to Pinata, and register the CID with your wrapped key.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Live
              </span>
            </div>
            <div className="mt-6">
              <UploadPanel />
            </div>
          </Card>

          <Card id="share" className="h-full p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-medium text-slate-900">Share Access</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Use your private key to unwrap the AES secret, rewrap it with the recipient&apos;s RSA key, and grant them on-chain access.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Live
              </span>
            </div>
            <div className="mt-6">
              <SharePanel />
            </div>
          </Card>

          <Card id="download" className="h-full p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-medium text-slate-900">Download & Decrypt</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Recipients prove access with their wallet, unwrap the shared AES key, and recover the original file locally.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Live
              </span>
            </div>
            <div className="mt-6">
              <DownloadPanel />
            </div>
          </Card>

          {PLACEHOLDER_SECTIONS.map((section) => (
            <Card key={section.id} id={section.id} className="h-full p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-medium text-slate-900">{section.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{section.description}</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {section.status}
                </span>
              </div>
              <div className="mt-6 rounded-md border border-dashed border-slate-200 bg-white/60 p-4 text-sm text-slate-400">
                UI wiring and logic will be added in later checkpoints.
              </div>
            </Card>
          ))}
        </div>

        <footer className="mt-12 text-center text-sm text-slate-500">
          <p>Checklist: L1 ✔ L2 ✔ L3 ✔ L4 ✔ L5 ✔ L6 ✔ L7 ✔ L8 ✔ L9 ✔.</p>
          <p className="mt-1">Next steps: any extended UX polish or audit tasks.</p>
        </footer>
      </section>
    </main>
  )
}

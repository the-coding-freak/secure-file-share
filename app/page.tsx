import Link from "next/link"
import { ArrowRight, CloudUpload, Lock, ShieldCheck, Sparkles, Users } from "lucide-react"
import { NavBar } from "@/components/nav-bar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const FEATURES = [
  {
    title: "Local-first encryption",
    description:
      "Files never leave your device in the clear. AES-256-GCM wraps content before it touches Pinata or the chain.",
    icon: Lock,
  },
  {
    title: "Granular access control",
    description:
      "Grant and revoke recipients on-chain while keeping their wrapped AES keys isolated per wallet.",
    icon: ShieldCheck,
  },
  {
    title: "Pinata-powered delivery",
    description:
      "IPFS storage with gateway fallbacks ensures every encrypted blob stays reachable across the LAN.",
    icon: CloudUpload,
  },
  {
    title: "Human-friendly UX",
    description:
      "Guided flows, progress states, and toasts help teams run secure transfers without memorizing CLI steps.",
    icon: Users,
  },
]

const STEPS = [
  {
    title: "Encrypt & upload",
    description: "Generate RSA keys, encrypt locally, and register the CID with a wrapped AES key.",
    href: "/upload",
  },
  {
    title: "Share access",
    description: "Rewrap secrets for each recipient and emit on-chain permissions in one click.",
    href: "/share",
  },
  {
    title: "Download & decrypt",
    description: "Recipients prove access with their wallet and recover plaintext entirely in-browser.",
    href: "/download",
  },
  {
    title: "Track your files",
    description: "Review registered assets, CID metadata, and recipient history at a glance.",
    href: "/files",
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <NavBar />
      <section className="relative overflow-hidden border-b border-slate-900/20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_transparent_55%)]" />
        <div className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 pt-20 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
            <Sparkles className="h-3.5 w-3.5" />
            Air-gapped friendly · ChainId 31337
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Ship encrypted files between trusted wallets without leaving the lab
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-300">
            Secure Share orchestrates AES-256-GCM encryption, RSA-OAEP key exchange, Pinata IPFS storage, and a Hardhat
            smart contract so your team can collaborate on sensitive payloads in minutes.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-emerald-500 hover:bg-emerald-400">
              <Link href="/upload" className="flex items-center gap-2">
                Launch app
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-slate-700 bg-transparent text-slate-100 hover:bg-slate-900">
              <Link href="/files">Explore my files</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-900/20 bg-slate-950/60">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold text-white">Why teams choose Secure Share</h2>
          <p className="mt-3 text-center text-sm text-slate-400">
            Every layer—from cryptography to smart contracts—focuses on pragmatic security for LAN deployments.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="h-full border border-slate-800 bg-slate-900/60 p-6 text-left">
                <feature.icon className="h-6 w-6 text-emerald-400" />
                <h3 className="mt-4 text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-900/20 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-12 lg:grid-cols-[2fr_3fr] lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold text-white">End-to-end workflow</h2>
              <p className="mt-3 text-sm text-slate-300">
                Follow the guided journey or jump straight to the step you need. Each view keeps the heavy lifting in the
                browser and leaves a clean audit trail on-chain.
              </p>
            </div>
            <div className="grid gap-4">
              {STEPS.map((step, index) => (
                <Card key={step.title} className="flex flex-col justify-between gap-3 border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-400">
                      Step {index + 1}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-white">{step.title}</h3>
                    <p className="text-sm text-slate-300">{step.description}</p>
                  </div>
                  <Button asChild variant="outline" className="border-slate-700 text-slate-100 hover:bg-slate-900">
                    <Link href={step.href} className="flex items-center gap-2">
                      Open
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="rounded-3xl border border-slate-900 bg-slate-900/70 p-10 text-center shadow-[0_0_60px_rgba(16,185,129,0.15)]">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">Ready to move sensitive payloads with confidence?</h2>
            <p className="mt-3 text-sm text-slate-300">
              Spin up the local Hardhat chain, connect MetaMask, and walk through the encrypted workflow end-to-end.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="bg-emerald-500 hover:bg-emerald-400">
                <Link href="/upload" className="flex items-center gap-2">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-slate-700 bg-transparent text-slate-100 hover:bg-slate-900">
                <Link href="/download">Try recipient flow</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-900/20 bg-slate-950 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-xs text-slate-500">
          <p>Built with Next.js 16, ethers v6, Hardhat, Web Crypto, and Pinata.</p>
          <p className="mt-1">Checkpoints L1–L9 complete · ongoing UX refinements welcomed.</p>
        </div>
      </footer>
    </main>
  )
}

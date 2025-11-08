"use client"

import Link from "next/link"

const NAV_LINKS = [
  { href: "#upload", label: "Upload" },
  { href: "#files", label: "My Files" },
  { href: "#share", label: "Share" },
  { href: "#download", label: "Download" },
]

import { WalletButton } from "./wallet-button"

export function NavBar() {
  return (
    <header className="border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Secure Share (LAN Demo)
        </Link>
        <div className="flex items-center gap-6">
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="transition hover:text-slate-900">
                {link.label}
              </a>
            ))}
          </nav>
          <WalletButton />
        </div>
      </div>
    </header>
  )
}

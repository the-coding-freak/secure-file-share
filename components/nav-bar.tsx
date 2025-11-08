"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { WalletButton } from "./wallet-button"

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/upload", label: "Upload" },
  { href: "/share", label: "Share" },
  { href: "/download", label: "Download" },
  { href: "/files", label: "My Files" },
]

export function NavBar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900 transition hover:text-slate-950">
            Secure Share
          </Link>
          <span className="hidden rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 sm:inline-flex">
            LAN Demo
          </span>
        </div>
        <div className="flex items-center gap-4">
          <nav className="hidden items-center gap-4 text-sm font-medium text-slate-600 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative transition hover:text-slate-900",
                  isActive(link.href) ? "text-slate-900" : "",
                )}
              >
                {link.label}
                {isActive(link.href) ? (
                  <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-slate-900" aria-hidden />
                ) : null}
              </Link>
            ))}
          </nav>
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="rounded-md border border-slate-200 p-2 text-slate-600 transition hover:text-slate-900"
              aria-label="Toggle navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <WalletButton />
        </div>
      </div>
      {mobileOpen ? (
        <nav className="border-t border-slate-200 bg-white p-4 md:hidden">
          <ul className="grid gap-3 text-sm font-medium text-slate-600">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "block rounded-md px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900",
                    isActive(link.href) ? "bg-slate-100 text-slate-900" : "",
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  )
}

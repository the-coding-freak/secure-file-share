import { type NextRequest, NextResponse } from "next/server"

const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ipfsHash = searchParams.get("hash")

    if (!ipfsHash) {
      return NextResponse.json({ error: "IPFS hash required" }, { status: 400 })
    }

    const url = `${PINATA_GATEWAY}/ipfs/${ipfsHash}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to retrieve from IPFS: ${response.statusText}`)
    }

    const blob = await response.blob()
    return new NextResponse(blob, {
      headers: {
        "Content-Type": blob.type,
        "Content-Disposition": "attachment; filename=file",
      },
    })
  } catch (error) {
    console.error("[v0] Pinata retrieval error:", error)
    return NextResponse.json({ error: "Retrieval failed" }, { status: 500 })
  }
}

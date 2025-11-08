import { type NextRequest, NextResponse } from "next/server"

const PINATA_JWT = process.env.PINATA_JWT

interface PinataUploadResponse {
  IpfsHash: string
  PinSize: number
  Timestamp: string
}

export async function POST(request: NextRequest) {
  try {
    if (!PINATA_JWT) {
      console.error("[v0] PINATA_JWT environment variable is not set")
      return NextResponse.json(
        { error: "Pinata JWT not configured. Add PINATA_JWT to your environment variables." },
        { status: 500 },
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as Blob
    const filename = formData.get("filename") as string

    if (!file || !filename) {
      return NextResponse.json({ error: "File and filename required" }, { status: 400 })
    }

    const pinataFormData = new FormData()
    pinataFormData.append("file", file, filename)

    console.log("[v0] Uploading to Pinata:", filename)
    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: pinataFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Pinata error:", response.status, errorText)
      return NextResponse.json({ error: `Pinata upload failed: ${response.statusText}` }, { status: response.status })
    }

    const data = await response.json()
    console.log("[v0] File uploaded to IPFS:", data.IpfsHash)

    return NextResponse.json({ ipfsHash: data.IpfsHash })
  } catch (error) {
    console.error("[v0] Pinata upload error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 })
  }
}

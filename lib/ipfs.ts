// L4: Pinata Integration Setup

interface PinataUploadResponse {
  IpfsHash: string
  PinSize: number
  Timestamp: string
}

/**
 * Upload encrypted file to Pinata IPFS (via server endpoint)
 */
export async function uploadToPinata(fileData: Blob, filename: string): Promise<string> {
  try {
    const formData = new FormData()
    formData.append("file", fileData, filename)
    formData.append("filename", filename)

    const response = await fetch("/api/ipfs/upload", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    const data = await response.json()
    console.log("[v0] File uploaded to IPFS:", data.ipfsHash)
    return data.ipfsHash
  } catch (error) {
    console.error("[v0] Pinata upload error:", error)
    throw error
  }
}

/**
 * Retrieve file from Pinata IPFS (via server endpoint)
 */
export async function retrieveFromPinata(ipfsHash: string): Promise<Blob> {
  try {
    const response = await fetch(`/api/ipfs/retrieve?hash=${encodeURIComponent(ipfsHash)}`)

    if (!response.ok) {
      throw new Error(`Failed to retrieve from IPFS: ${response.statusText}`)
    }

    return await response.blob()
  } catch (error) {
    console.error("[v0] Pinata retrieval error:", error)
    throw error
  }
}

/**
 * Check if Pinata is configured (gateway is always available)
 */
export function isPinataConfigured(): boolean {
  return true
}

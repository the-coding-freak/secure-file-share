import path from "node:path"
import { config as loadEnv } from "dotenv"
import { decryptData, encryptData, generateEncryptionKey, generateIV } from "../lib/crypto"

const PINATA_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS"
const DEFAULT_GATEWAY = "https://gateway.pinata.cloud"

const envPath = path.resolve(__dirname, "../.env.local")
loadEnv({ path: envPath, override: false })
loadEnv({ override: false })

async function runRoundTrip(): Promise<void> {
  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    throw new Error("PINATA_JWT environment variable is required for the Pinata self-test")
  }

  const plaintext = `Pinata self-test ${new Date().toISOString()}`
  const aesKey = generateEncryptionKey()
  const iv = generateIV()
  const ciphertext = await encryptData(plaintext, aesKey, iv)

  const filename = `pinata-self-test-${Date.now()}.txt`
  const blob = new Blob([ciphertext], { type: "text/plain" })
  const formData = new FormData()
  formData.append("file", blob, filename)

  const uploadResponse = await fetch(PINATA_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  })

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    throw new Error(`Pinata upload failed (${uploadResponse.status}): ${errorText}`)
  }

  const uploadJson = (await uploadResponse.json()) as { IpfsHash: string }
  const cid = uploadJson.IpfsHash
  if (!cid) {
    throw new Error("Pinata upload did not return an IpfsHash")
  }
  console.log(`[pinata] Uploaded encrypted test blob → CID ${cid}`)

  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || DEFAULT_GATEWAY
  const downloadResponse = await fetch(`${gateway}/ipfs/${cid}`)
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download from gateway (${downloadResponse.status}): ${downloadResponse.statusText}`)
  }
  const downloadedCiphertext = await downloadResponse.text()

  const recovered = await decryptData(downloadedCiphertext, aesKey, iv)
  if (recovered !== plaintext) {
    throw new Error("Decrypted content does not match original plaintext")
  }

  console.log("[pinata] Download + decrypt succeeded; plaintext integrity verified.")
}

void runRoundTrip().catch((error) => {
  console.error("[pinata] Self-test failed:", error)
  process.exit(1)
})

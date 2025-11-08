import { cryptoSelfTest } from "../lib/crypto"

async function main() {
  try {
    await cryptoSelfTest()
    console.log("[crypto] AES-GCM and RSA-OAEP round-trip succeeded.")
    process.exit(0)
  } catch (error) {
    console.error("[crypto] Self-test failed:", error)
    process.exit(1)
  }
}

void main()

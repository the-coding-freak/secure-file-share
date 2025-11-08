// L2: Cryptographic Utilities (AES-256-GCM + RSA-OAEP)

type SubtleCryptoLike = SubtleCrypto

function getSubtle(): SubtleCryptoLike {
  const crypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined

  if (crypto?.subtle) {
    return crypto.subtle
  }

  if (typeof window !== "undefined" && window.crypto && !window.isSecureContext) {
    throw new Error(
      "Web Crypto requires a secure context (HTTPS or http://localhost). Serve the app over HTTPS or switch back to localhost to continue.",
    )
  }

  throw new Error("Web Crypto API is not available in this environment")
}

function getRandomBytes(length: number): Uint8Array {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint8Array(length))
  }
  throw new Error("Secure random generator not available")
}

function arrayBufferToBase64(data: ArrayBuffer | ArrayBufferView): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64")
  }
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64, "base64")
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function stringToArrayBuffer(data: string): ArrayBuffer {
  return new TextEncoder().encode(data).buffer
}

function arrayBufferToString(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer)
}

/**
 * Generate a random AES-256 key encoded in base64
 */
export function generateEncryptionKey(): string {
  const keyBytes = getRandomBytes(32)
  return arrayBufferToBase64(keyBytes)
}

/**
 * Generate a random IV (12 bytes) encoded in base64
 */
export function generateIV(): string {
  const ivBytes = getRandomBytes(12)
  return arrayBufferToBase64(ivBytes)
}

/**
 * Encrypt data using AES-256-GCM. Returns ciphertext as base64.
 */
export async function encryptData(data: string, base64Key: string, base64Iv: string): Promise<string> {
  try {
    const subtle = getSubtle()
    const key = await subtle.importKey("raw", base64ToArrayBuffer(base64Key), { name: "AES-GCM" }, false, ["encrypt"])
    const encrypted = await subtle.encrypt({ name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(base64Iv)) }, key, stringToArrayBuffer(data))
    return arrayBufferToBase64(encrypted)
  } catch (error) {
    console.error("[v0] AES-GCM encryption error:", error)
    throw error
  }
}

/**
 * Decrypt AES-256-GCM data encoded in base64
 */
export async function decryptData(base64Ciphertext: string, base64Key: string, base64Iv: string): Promise<string> {
  try {
    const subtle = getSubtle()
    const key = await subtle.importKey("raw", base64ToArrayBuffer(base64Key), { name: "AES-GCM" }, false, ["decrypt"])
    const decrypted = await subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(base64Iv)) },
      key,
      base64ToArrayBuffer(base64Ciphertext),
    )
    return arrayBufferToString(decrypted)
  } catch (error) {
    console.error("[v0] AES-GCM decryption error:", error)
    throw error
  }
}

function validatePem(pem: string, type: "PUBLIC" | "PRIVATE"): string {
  const trimmed = pem.trim()
  const header = `-----BEGIN ${type} KEY-----`
  const footer = `-----END ${type} KEY-----`

  if (!trimmed.includes(header) || !trimmed.includes(footer)) {
    throw new Error(`Invalid RSA ${type.toLowerCase()} key. Expected PEM with ${header} / ${footer}.`)
  }

  return trimmed
}

function stripPem(pem: string, type: "PUBLIC" | "PRIVATE"): ArrayBuffer {
  const validated = validatePem(pem, type)
  const cleaned = validated.replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "")
  return base64ToArrayBuffer(cleaned)
}

function exportPem(buffer: ArrayBuffer, type: "PUBLIC" | "PRIVATE"): string {
  const base64 = arrayBufferToBase64(buffer)
  const formatted = base64.match(/.{1,64}/g)?.join("\n") ?? base64
  return `-----BEGIN ${type} KEY-----\n${formatted}\n-----END ${type} KEY-----`
}

/**
 * Generate RSA-OAEP key pair (2048-bit, SHA-256)
 */
export async function generateRsaKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const subtle = getSubtle()
  const keyPair = await subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  )

  const publicKey = await subtle.exportKey("spki", keyPair.publicKey)
  const privateKey = await subtle.exportKey("pkcs8", keyPair.privateKey)

  return {
    publicKey: exportPem(publicKey, "PUBLIC"),
    privateKey: exportPem(privateKey, "PRIVATE"),
  }
}

async function importRsaPublicKey(publicKeyPem: string): Promise<CryptoKey> {
  const subtle = getSubtle()
  try {
    return await subtle.importKey(
      "spki",
      stripPem(publicKeyPem, "PUBLIC"),
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["encrypt"],
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === "DataError") {
      throw new Error("Invalid RSA public key. Ensure the full PEM export is pasted, including header and footer.")
    }
    throw error
  }
}

async function importRsaPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  const subtle = getSubtle()
  try {
    return await subtle.importKey(
      "pkcs8",
      stripPem(privateKeyPem, "PRIVATE"),
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["decrypt"],
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === "DataError") {
      throw new Error("Invalid RSA private key. Double-check that the PEM is correct and unmodified.")
    }
    throw error
  }
}

/**
 * Wrap (encrypt) an AES key with RSA-OAEP. Inputs/outputs are base64 strings.
 */
export async function wrapAesKeyWithRsa(publicKeyPem: string, base64AesKey: string): Promise<string> {
  const publicKey = await importRsaPublicKey(publicKeyPem)
  const subtle = getSubtle()
  const wrapped = await subtle.encrypt({ name: "RSA-OAEP" }, publicKey, base64ToArrayBuffer(base64AesKey))
  return arrayBufferToBase64(wrapped)
}

/**
 * Unwrap (decrypt) an AES key with RSA-OAEP. Returns AES key as base64 string.
 */
export async function unwrapAesKeyWithRsa(privateKeyPem: string, wrappedKeyBase64: string): Promise<string> {
  const privateKey = await importRsaPrivateKey(privateKeyPem)
  const subtle = getSubtle()
  const unwrapped = await subtle.decrypt({ name: "RSA-OAEP" }, privateKey, base64ToArrayBuffer(wrappedKeyBase64))
  return arrayBufferToBase64(unwrapped)
}

/**
 * Self-test helper to validate AES-GCM + RSA-OAEP round-trip.
 */
export async function cryptoSelfTest(): Promise<boolean> {
  const message = "Secure file sharing test"
  const aesKey = generateEncryptionKey()
  const iv = generateIV()
  const cipher = await encryptData(message, aesKey, iv)
  const recovered = await decryptData(cipher, aesKey, iv)
  if (recovered !== message) {
    throw new Error("AES-GCM self-test failed: plaintext mismatch")
  }

  const { publicKey, privateKey } = await generateRsaKeyPair()
  const wrapped = await wrapAesKeyWithRsa(publicKey, aesKey)
  const unwrapped = await unwrapAesKeyWithRsa(privateKey, wrapped)
  if (unwrapped !== aesKey) {
    throw new Error("RSA-OAEP self-test failed: AES key mismatch")
  }

  return true
}

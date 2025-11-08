import CryptoJS from "crypto-js"

// L2: Cryptographic Utilities

/**
 * Generate a random AES encryption key
 */
export function generateEncryptionKey(): string {
  const key = CryptoJS.lib.WordArray.random(32)
  return key.toString()
}

/**
 * Generate a random IV for AES encryption
 */
export function generateIV(): string {
  const iv = CryptoJS.lib.WordArray.random(16)
  return iv.toString()
}

/**
 * Encrypt data using AES-256-CBC
 */
export function encryptData(data: string, key: string, iv: string): string {
  try {
    const encrypted = CryptoJS.AES.encrypt(data, CryptoJS.enc.Hex.parse(key), {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    })
    return encrypted.toString()
  } catch (error) {
    console.error("[v0] Encryption error:", error)
    throw error
  }
}

/**
 * Decrypt data using AES-256-CBC
 */
export function decryptData(encrypted: string, key: string, iv: string): string {
  try {
    const decrypted = CryptoJS.AES.decrypt(encrypted, CryptoJS.enc.Hex.parse(key), {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    })
    return decrypted.toString(CryptoJS.enc.Utf8)
  } catch (error) {
    console.error("[v0] Decryption error:", error)
    throw error
  }
}

/**
 * Generate HMAC-SHA256 for data integrity verification
 */
export function generateHMAC(data: string, secret: string): string {
  return CryptoJS.HmacSHA256(data, secret).toString()
}

/**
 * Verify HMAC-SHA256
 */
export function verifyHMAC(data: string, secret: string, hmac: string): boolean {
  const computed = generateHMAC(data, secret)
  return computed === hmac
}

/**
 * Derive key from password using PBKDF2
 */
export function deriveKeyFromPassword(password: string, salt = "", iterations = 1000): string {
  const derivedKey = CryptoJS.PBKDF2(password, salt, {
    keySize: 8,
    iterations,
  })
  return derivedKey.toString()
}

// Cifrado de secretos por tenant (AES-256-GCM).
// Se usa para las connection strings de la BD del tenant y para TenantSecretos
// (IA / storage / SMTP / WhatsApp / SECOP). El texto plano NUNCA se guarda ni se
// envía al navegador. La clave vive en ENCRYPTION_KEY (32 bytes hex), fuera del repo.
import crypto from "node:crypto"

const ALGO = "aes-256-gcm"

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) throw new Error("ENCRYPTION_KEY no configurada")
  const key = Buffer.from(hex, "hex")
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY debe ser de 32 bytes (64 caracteres hex)")
  }
  return key
}

/**
 * Cifra texto plano. Formato de salida: `base64(iv).base64(authTag).base64(ciphertext)`.
 * IV aleatorio por operación → dos cifrados del mismo texto dan resultados distintos.
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".")
}

/** Descifra un payload producido por `encrypt`. Lanza si el authTag no valida (manipulado). */
export function decrypt(payload: string): string {
  const key = getKey()
  const [ivB64, tagB64, ctB64] = payload.split(".")
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Payload cifrado inválido")
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8")
}

/** Cifra un objeto JSON (p. ej. TenantSecretos). */
export function encryptJson(obj: unknown): string {
  return encrypt(JSON.stringify(obj))
}

/** Descifra a objeto; devuelve `null` si el input es vacío. */
export function decryptJson<T>(payload: string | null | undefined): T | null {
  if (!payload) return null
  return JSON.parse(decrypt(payload)) as T
}

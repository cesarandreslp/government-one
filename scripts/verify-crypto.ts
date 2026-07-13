import "dotenv/config"
import { encrypt, decrypt, encryptJson, decryptJson } from "../src/lib/encryption"

const secreto = "postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require"
const cifrado = encrypt(secreto)
const descifrado = decrypt(cifrado)
console.log("string round-trip:", descifrado === secreto ? "✅ OK" : "❌ FALLO")
console.log("  cifrado ≠ plano:", cifrado !== secreto ? "✅" : "❌", "| formato iv.tag.ct:", cifrado.split(".").length === 3 ? "✅" : "❌")

const obj = { neonApiKey: "napi_abc", nit: "890000464-3" }
const jc = encryptJson(obj)
const jd = decryptJson<typeof obj>(jc)
console.log("json round-trip:", JSON.stringify(jd) === JSON.stringify(obj) ? "✅ OK" : "❌ FALLO")

// manipulación detectada
try { decrypt(cifrado.slice(0, -4) + "AAAA"); console.log("tamper check: ❌ no detectó") }
catch { console.log("tamper check: ✅ detecta manipulación") }

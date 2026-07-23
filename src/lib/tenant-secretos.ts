import { prismaMeta } from "@/lib/prisma-meta"
import { encryptJson, decryptJson } from "@/lib/encryption"

// Secretos POR TENANT (IA / storage / SMTP / WhatsApp / SECOP…) — regla de oro: ningún servicio
// credenciado se comparte entre tenants, cada entidad tiene su propia clave. Se guardan como UN
// blob JSON cifrado en `Tenant.secretosEncriptados` (AES-256-GCM, ver encryption.ts). El texto
// plano nunca se expone al navegador ni se lee fuera del servidor.

export interface TenantSecretos {
  /** Clave de API de Anthropic para clasificación de PQRSD por IA (y futuros usos del tenant). */
  ia?: string
}

async function leerSecretos(tenantId: string): Promise<TenantSecretos> {
  const t = await prismaMeta.tenant.findUnique({ where: { id: tenantId }, select: { secretosEncriptados: true } })
  return decryptJson<TenantSecretos>(t?.secretosEncriptados) ?? {}
}

/** Lee un secreto del tenant (descifrado). `null` si el tenant no lo tiene configurado. */
export async function obtenerSecretoTenant<K extends keyof TenantSecretos>(
  tenantId: string,
  clave: K,
): Promise<TenantSecretos[K] | null> {
  const secretos = await leerSecretos(tenantId)
  return secretos[clave] ?? null
}

/** Guarda (o reemplaza) un secreto del tenant. Solo lo debe llamar el superadmin de plataforma. */
export async function guardarSecretoTenant<K extends keyof TenantSecretos>(
  tenantId: string,
  clave: K,
  valor: TenantSecretos[K],
): Promise<void> {
  const actuales = await leerSecretos(tenantId)
  const nuevos = { ...actuales, [clave]: valor }
  await prismaMeta.tenant.update({ where: { id: tenantId }, data: { secretosEncriptados: encryptJson(nuevos) } })
}

/** ¿El tenant tiene un secreto configurado (sin exponer su valor)? */
export async function tieneSecretoTenant(tenantId: string, clave: keyof TenantSecretos): Promise<boolean> {
  const v = await obtenerSecretoTenant(tenantId, clave)
  return !!v
}

// neon.ts — Creación de BDs de tenant en Neon (API v2). UN PROYECTO Neon por tenant
// (aislamiento total, patrón "Neon for Platforms"). Requiere NEON_API_KEY (org-scoped
// → se pasa org_id al crear). Portado del proyecto anterior (probado).
// Docs: https://api-docs.neon.tech/reference/createproject

const NEON_API = "https://console.neon.tech/api/v2"

export interface NeonProjectResult {
  projectId: string
  databaseName: string
  /** Connection string DIRECTA (no pooled) — migraciones/seeding. */
  directUrl: string
  /** Connection string POOLED — runtime de la app (pgBouncer de Neon). */
  pooledUrl: string
}

function apiKey(): string {
  const k = process.env.NEON_API_KEY?.trim()
  if (!k) throw new Error("[neon] NEON_API_KEY no definida en el entorno.")
  return k
}

/** Resuelve el org_id (las keys de organización lo exigen al crear proyectos). */
async function getOrgId(): Promise<string | undefined> {
  const fromEnv = process.env.NEON_ORG_ID?.trim()
  if (fromEnv) return fromEnv
  try {
    const res = await fetch(`${NEON_API}/users/me/organizations`, {
      headers: { Authorization: `Bearer ${apiKey()}`, Accept: "application/json" },
    })
    if (!res.ok) return undefined
    const data = (await res.json()) as { organizations?: { id?: string }[] }
    return data.organizations?.[0]?.id
  } catch {
    return undefined
  }
}

/** Deriva el host pooled insertando "-pooler" en el primer label del host. */
function toPooled(uri: string): string {
  try {
    const u = new URL(uri)
    const labels = u.hostname.split(".")
    if (labels[0] && !labels[0].includes("-pooler")) {
      labels[0] = `${labels[0]}-pooler`
      u.hostname = labels.join(".")
    }
    return u.toString()
  } catch {
    return uri
  }
}

/** Crea un proyecto Neon para un tenant y devuelve sus connection strings. */
export async function createNeonProject(
  nombre: string,
  region = "aws-us-east-1",
): Promise<NeonProjectResult> {
  const orgId = await getOrgId()
  const project: Record<string, unknown> = { name: nombre, region_id: region }
  if (orgId) project.org_id = orgId

  const res = await fetch(`${NEON_API}/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ project }),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`[neon] createProject ${res.status}: ${t.slice(0, 400)}`)
  }

  const data = (await res.json()) as {
    project?: { id?: string }
    connection_uris?: { connection_uri?: string; connection_parameters?: { database?: string } }[]
    databases?: { name?: string }[]
  }

  const direct = data.connection_uris?.[0]?.connection_uri
  if (!direct) throw new Error("[neon] La respuesta no incluyó connection_uri")

  const databaseName =
    data.databases?.[0]?.name ??
    data.connection_uris?.[0]?.connection_parameters?.database ??
    "neondb"

  return {
    projectId: data.project?.id ?? "",
    databaseName,
    directUrl: direct,
    pooledUrl: toPooled(direct),
  }
}

/** Elimina un proyecto Neon (rollback si el aprovisionamiento falla luego de crearlo). */
export async function deleteNeonProject(projectId: string): Promise<void> {
  if (!projectId) return
  await fetch(`${NEON_API}/projects/${projectId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey()}`, Accept: "application/json" },
  }).catch(() => null)
}

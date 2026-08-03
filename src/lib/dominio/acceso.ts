import type { PrismaClient } from "@/generated/tenant/client"
import { unirGrants, grantsIncluyen, type Grants } from "./capacidades"

// Helpers de ACCESO de la fundación de dominio. Operan sobre la BD de UN tenant.
// Principio: el acceso NO viene del rol (identidad); viene de las CAPACIDADES que confieren
// los cargos que la persona EJERCE HOY (vínculos vigentes). Roles = solo identidad.

/** Cliente Prisma de un tenant (o un cliente de transacción con los mismos modelos). */
export type TenantDB = Pick<PrismaClient, "vinculacionCargo" | "ausencia" | "cargo">

/** ¿El vínculo persona↔cargo está vigente en `ahora`? (hasta == null → sigue vigente). */
export function esVinculacionVigente(
  v: { desde: Date; hasta: Date | null },
  ahora: Date = new Date(),
): boolean {
  return v.desde <= ahora && (v.hasta === null || v.hasta >= ahora)
}

/** Filtro Prisma de vigencia temporal para vínculos/actos con desde/hasta. */
function whereVigente(ahora: Date) {
  return { desde: { lte: ahora }, OR: [{ hasta: null }, { hasta: { gte: ahora } }] }
}

/** Vínculos vigentes de una persona, con su cargo cargado. */
export async function vinculacionesVigentes(db: TenantDB, usuarioId: string, ahora: Date = new Date()) {
  return db.vinculacionCargo.findMany({
    where: { usuarioId, ...whereVigente(ahora) },
    include: { cargo: true },
  })
}

/**
 * Capacidades efectivas de una persona = UNIÓN de los grants de todos los cargos ACTIVOS
 * que ejerce con vínculo vigente. Un encargo SUMA autoridad mientras dura; el cargo base se
 * conserva. Sin cargos vigentes → grants vacíos (sin acceso).
 */
export async function capacidadesEfectivas(
  db: TenantDB,
  usuarioId: string,
  ahora: Date = new Date(),
): Promise<Grants> {
  const vinculos = await vinculacionesVigentes(db, usuarioId, ahora)
  const grantsDeCargos = vinculos
    .filter((v) => v.cargo.activo)
    .map((v) => (v.cargo.grants ?? {}) as unknown as Grants)
  return unirGrants(...grantsDeCargos)
}

/** ¿La persona tiene esta capacidad (vía algún cargo vigente)? */
export async function tieneCapacidad(
  db: TenantDB,
  usuarioId: string,
  modulo: string,
  capacidad: string,
  ahora: Date = new Date(),
): Promise<boolean> {
  const grants = await capacidadesEfectivas(db, usuarioId, ahora)
  return grantsIncluyen(grants, modulo, capacidad)
}

export interface AlcanceDependencias {
  /** Servicio compartido (Contratación central, Jurídica, Banco de Proyectos/PDM…) o admin del
   *  tenant → ve TODO el tenant sin filtrar por dependencia (son, por definición, transversales). */
  veGlobal: boolean
  /** Ids de dependencia visibles en modo PARTICULAR: la familia completa (raíz + descendientes)
   *  de cada dependencia donde el funcionario ejerce hoy un cargo vigente. Vacío si veGlobal. */
  dependenciaIds: string[]
}

/**
 * Alcance de un funcionario para módulos transversales por secretaría (Contratación, Banco de
 * Proyectos): cada secretaría ve SOLO lo que le corresponde ejecutar (su familia de dependencias:
 * raíz + todas las hijas), salvo que ejerza en una dependencia `esServicioCompartido` — esas
 * sirven a TODA la entidad por diseño y ven TODO (ver comentario del campo en el schema).
 */
export async function alcanceDependencias(
  db: Pick<PrismaClient, "vinculacionCargo" | "dependencia">,
  usuarioId: string,
  ahora: Date = new Date(),
): Promise<AlcanceDependencias> {
  const vinculos = await db.vinculacionCargo.findMany({
    where: { usuarioId, ...whereVigente(ahora) },
    include: { cargo: { include: { dependencia: true } } },
  })
  const propias = vinculos.filter((v) => v.cargo.activo).map((v) => v.cargo.dependencia)
  if (propias.length === 0) return { veGlobal: false, dependenciaIds: [] }
  if (propias.some((d) => d.esServicioCompartido)) return { veGlobal: true, dependenciaIds: [] }

  const todas = await db.dependencia.findMany()
  const porId = new Map(todas.map((d) => [d.id, d]))
  // Raíz de la FAMILIA = la secretaría/oficina de primer nivel, no el tope absoluto del árbol
  // (el despacho, del que cuelgan TODAS las secretarías) — si subiéramos hasta ahí, la familia
  // de cualquier dependencia terminaría siendo el tenant entero.
  const raizDe = (id: string): string => {
    const d = porId.get(id)
    const padre = d?.padreId ? porId.get(d.padreId) : undefined
    if (!padre || !padre.padreId) return id // yo soy el tope absoluto, o mi padre lo es
    return raizDe(d!.padreId!)
  }
  const descendientesDe = (id: string): string[] => {
    const hijas = todas.filter((d) => d.padreId === id).map((d) => d.id)
    return [id, ...hijas.flatMap(descendientesDe)]
  }
  const ids = new Set<string>()
  for (const raiz of new Set(propias.map((d) => raizDe(d.id)))) {
    for (const id of descendientesDe(raiz)) ids.add(id)
  }
  return { veGlobal: false, dependenciaIds: [...ids] }
}

/** Usuarios que ejercen HOY un cargo en alguna de estas dependencias — para incluir en el modo
 *  PARTICULAR sus contratos aún sin RP/CDP (recién creados, todavía no financian un proyecto). */
export async function usuariosDeAlcance(
  db: Pick<PrismaClient, "vinculacionCargo">,
  dependenciaIds: string[],
  ahora: Date = new Date(),
): Promise<string[]> {
  if (dependenciaIds.length === 0) return []
  const vinculos = await db.vinculacionCargo.findMany({
    where: { ...whereVigente(ahora), cargo: { dependenciaId: { in: dependenciaIds } } },
    select: { usuarioId: true },
  })
  return [...new Set(vinculos.map((v) => v.usuarioId))]
}

/** ¿La persona está ausente (vacaciones/licencia/…) en `ahora`? (enriquecimiento RRHH). */
export async function usuarioAusente(db: TenantDB, usuarioId: string, ahora: Date = new Date()): Promise<boolean> {
  const a = await db.ausencia.findFirst({
    where: { usuarioId, desde: { lte: ahora }, hasta: { gte: ahora } },
    select: { id: true },
  })
  return a !== null
}

/**
 * Usuarios (id + nombre) que hoy tienen una capacidad dada, vía algún cargo vigente. Recorre
 * TODOS los vínculos vigentes (no hay índice sobre el JSON de grants) — uso pensado para
 * selectores admin (ej. "asignar abogado"), no para rutas de alto tráfico.
 */
export async function usuariosConCapacidad(
  db: Pick<PrismaClient, "vinculacionCargo"> & { usuario: PrismaClient["usuario"] },
  modulo: string,
  capacidad: string,
  ahora: Date = new Date(),
): Promise<Array<{ id: string; nombre: string; apellido: string }>> {
  const vinculos = await db.vinculacionCargo.findMany({
    where: whereVigente(ahora),
    include: { cargo: true, usuario: { select: { id: true, nombre: true, apellido: true, activo: true } } },
  })
  const vistos = new Map<string, { id: string; nombre: string; apellido: string }>()
  for (const v of vinculos) {
    if (!v.cargo.activo || !v.usuario.activo) continue
    const grants = (v.cargo.grants ?? {}) as unknown as Grants
    if (grantsIncluyen(grants, modulo, capacidad)) {
      vistos.set(v.usuario.id, { id: v.usuario.id, nombre: v.usuario.nombre, apellido: v.usuario.apellido })
    }
  }
  return [...vistos.values()]
}

export type ViaEjercicio = "ENCARGADO" | "TITULAR" | "PROVISIONAL"
export interface Ejerciente {
  usuarioId: string
  via: ViaEjercicio
}

/**
 * ¿Quién EJERCE el cargo HOY? Resuelve el ocupante para ruteo/aprobaciones/cabeza de dependencia,
 * evitando rutear al titular ausente:
 *   1. ENCARGADO con vínculo vigente → ese (cubre la ausencia).
 *   2. si no, TITULAR/PROVISIONAL vigente SIN ausencia vigente → ese.
 *   3. si no (titular ausente y sin encargado) → null → el llamador hace fallback
 *      (cargo jefatura superior / dependencia de servicio compartido).
 */
export async function quienEjerce(
  db: TenantDB,
  cargoId: string,
  ahora: Date = new Date(),
): Promise<Ejerciente | null> {
  const vinculos = await db.vinculacionCargo.findMany({
    where: { cargoId, ...whereVigente(ahora) },
    orderBy: { desde: "desc" },
  })

  const encargado = vinculos.find((v) => v.tipo === "ENCARGADO")
  if (encargado) return { usuarioId: encargado.usuarioId, via: "ENCARGADO" }

  for (const v of vinculos) {
    if (v.tipo !== "TITULAR" && v.tipo !== "PROVISIONAL") continue
    if (!(await usuarioAusente(db, v.usuarioId, ahora))) {
      return { usuarioId: v.usuarioId, via: v.tipo }
    }
  }
  return null
}

/**
 * Cabeza de una dependencia: su cargo `esJefatura` activo y quién lo ejerce hoy.
 * Base del fallback de ruteo ("si nadie ejerce el cargo específico, subir a la jefatura").
 * `null` si la dependencia no tiene jefatura definida.
 */
export async function cabezaDeDependencia(db: TenantDB, dependenciaId: string, ahora: Date = new Date()) {
  const jefatura = await db.cargo.findFirst({
    where: { dependenciaId, esJefatura: true, activo: true },
  })
  if (!jefatura) return null
  return { cargo: jefatura, ejerce: await quienEjerce(db, jefatura.id, ahora) }
}

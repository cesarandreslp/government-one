import "server-only"
import type { PrismaClient } from "@/generated/tenant/client"
import { quienEjerce, cabezaDeDependencia } from "@/lib/dominio/acceso"
import { grantsIncluyen, type Grants } from "@/lib/dominio/capacidades"
import { obtenerSecretoTenant } from "@/lib/tenant-secretos"
import { clasificarCargoPqrsd, type CandidatoCargo } from "@/lib/ia/clasificar-pqrsd"

// RUTEO de PQRSD por CARGO — el diferenciador del módulo. Dada la dependencia competente,
// recomienda el CARGO responsable y resuelve al funcionario que lo EJERCE HOY (quienEjerce:
// encargado → titular sin ausencia → …). Así, si el titular se ausenta y hay un encargado, la
// siguiente PQRSD se asigna al encargado automáticamente, sin tocar la regla de ruteo.
//
// Cuando el ciudadano NO da dependencia (el caso típico del portal público), antes de caer al
// fallback de servicio compartido se intenta clasificar por IA contra las `funciones` de los
// cargos con capacidad de responder — solo si el tenant configuró su propia clave de IA
// (tenant-secretos.ts). Sin clave configurada, o si la IA falla/no está segura, el comportamiento
// es EXACTAMENTE el de siempre (fallback de servicio compartido) — nunca un caso nuevo a mano.

export type RuteoDB = Pick<PrismaClient, "cargo" | "dependencia" | "vinculacionCargo" | "ausencia">

export interface Asignacion {
  dependenciaId: string
  cargoId: string
  cargoNombre: string
  /** Funcionario que ejerce el cargo hoy; null si el cargo no tiene ocupante (queda RECIBIDA). */
  usuarioId: string | null
}

function tieneResponder(grants: unknown): boolean {
  return grantsIncluyen((grants ?? {}) as Grants, "ventanilla_unica", "responder")
}
function tieneVu(grants: unknown): boolean {
  const g = (grants ?? {}) as Grants
  return grantsIncluyen(g, "ventanilla_unica", "responder") || grantsIncluyen(g, "ventanilla_unica", "asignar")
}

/** Busca en una dependencia el cargo que debe responder y quién lo ejerce. */
async function asignarEnDependencia(db: RuteoDB, dependenciaId: string): Promise<Asignacion | null> {
  const cargos = await db.cargo.findMany({ where: { dependenciaId, activo: true } })

  // Preferir cargos con capacidad de responder (jefatura primero).
  const conResponder = cargos
    .filter((c) => tieneResponder(c.grants))
    .sort((a, b) => Number(b.esJefatura) - Number(a.esJefatura))

  for (const cargo of conResponder) {
    const ej = await quienEjerce(db, cargo.id)
    if (ej) return { dependenciaId, cargoId: cargo.id, cargoNombre: cargo.nombre, usuarioId: ej.usuarioId }
  }

  // Fallback: la cabeza de la dependencia (aunque su grant no incluya responder).
  const cabeza = await cabezaDeDependencia(db, dependenciaId)
  if (cabeza) {
    return {
      dependenciaId,
      cargoId: cabeza.cargo.id,
      cargoNombre: cabeza.cargo.nombre,
      usuarioId: cabeza.ejerce?.usuarioId ?? null,
    }
  }

  // Hay cargos con responder pero nadie los ejerce → asignar al cargo (sin ocupante).
  if (conResponder[0]) {
    return { dependenciaId, cargoId: conResponder[0].id, cargoNombre: conResponder[0].nombre, usuarioId: null }
  }
  return null
}

/**
 * Cargos "atendibles" tenant-wide: activos, con capacidad `ventanilla_unica:responder` y con
 * `funciones` descritas (sin funciones no hay nada que la IA pueda comparar contra el texto).
 */
async function candidatosClasificables(db: RuteoDB): Promise<CandidatoCargo[]> {
  const cargos = await db.cargo.findMany({
    where: { activo: true, funciones: { not: null } },
    include: { dependencia: true },
  })
  return cargos
    .filter((c) => tieneResponder(c.grants))
    .map((c) => ({
      id: c.id,
      depId: c.dependenciaId,
      depCodigo: c.dependencia.codigo,
      depNombre: c.dependencia.nombre,
      cargoNombre: c.nombre,
      funciones: c.funciones!,
    }))
}

/** Clasifica por IA (si el tenant tiene clave configurada) y resuelve quién ejerce el cargo elegido. */
async function resolverAsignacionPorIA(
  db: RuteoDB,
  tenantId: string,
  descripcion: string,
): Promise<Asignacion | null> {
  const credencial = await obtenerSecretoTenant(tenantId, "ia")
  if (!credencial) return null

  const candidatos = await candidatosClasificables(db)
  const cargoId = await clasificarCargoPqrsd(descripcion, candidatos, credencial)
  if (!cargoId) return null

  const cargo = candidatos.find((c) => c.id === cargoId)
  if (!cargo) return null
  const ej = await quienEjerce(db, cargoId)
  return { dependenciaId: cargo.depId, cargoId, cargoNombre: cargo.cargoNombre, usuarioId: ej?.usuarioId ?? null }
}

/**
 * Resuelve a quién se asigna una PQRSD. Si se da la dependencia competente (el funcionario que
 * radica la conoce), rutea ahí de forma determinística. Si no se dio dependencia (típico del
 * portal público), intenta clasificar por IA contra las funciones de los cargos — y si no hay
 * clave de IA configurada o no encuentra un match claro, cae a una dependencia de SERVICIO
 * COMPARTIDO con capacidad de Ventanilla Única (típicamente Atención al Ciudadano). Null si nada aplica.
 */
export async function resolverAsignacionVu(
  db: RuteoDB,
  tenantId: string,
  dependenciaId: string | null,
  descripcion: string,
): Promise<Asignacion | null> {
  if (dependenciaId) {
    const a = await asignarEnDependencia(db, dependenciaId)
    if (a?.usuarioId) return a
    // si la dependencia dada no tiene ocupante, seguimos al fallback compartido pero
    // conservamos 'a' por si el fallback tampoco resuelve.
    const fallback = await fallbackServicioCompartido(db)
    return fallback ?? a
  }

  const porIA = await resolverAsignacionPorIA(db, tenantId, descripcion)
  if (porIA) return porIA
  return fallbackServicioCompartido(db)
}

async function fallbackServicioCompartido(db: RuteoDB): Promise<Asignacion | null> {
  const compartidas = await db.dependencia.findMany({
    where: { esServicioCompartido: true, activa: true },
    include: { cargos: { where: { activo: true } } },
  })
  for (const dep of compartidas) {
    const tieneCargoVu = dep.cargos.some((c) => tieneVu(c.grants))
    if (!tieneCargoVu) continue
    const a = await asignarEnDependencia(db, dep.id)
    if (a) return a
  }
  return null
}

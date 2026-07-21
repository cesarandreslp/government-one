import "server-only"
import type { PrismaClient } from "@/generated/tenant/client"
import { quienEjerce, cabezaDeDependencia } from "@/lib/dominio/acceso"
import { grantsIncluyen, type Grants } from "@/lib/dominio/capacidades"

// RUTEO de PQRSD por CARGO — el diferenciador del módulo. Dada la dependencia competente,
// recomienda el CARGO responsable y resuelve al funcionario que lo EJERCE HOY (quienEjerce:
// encargado → titular sin ausencia → …). Así, si el titular se ausenta y hay un encargado, la
// siguiente PQRSD se asigna al encargado automáticamente, sin tocar la regla de ruteo.

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
 * Resuelve a quién se asigna una PQRSD. Si se da la dependencia competente, rutea ahí; si no
 * hay asignación posible (o no se dio dependencia), cae a una dependencia de SERVICIO COMPARTIDO
 * con capacidad de Ventanilla Única (típicamente Atención al Ciudadano). Null si nada aplica.
 */
export async function resolverAsignacionVu(
  db: RuteoDB,
  dependenciaId: string | null,
): Promise<Asignacion | null> {
  if (dependenciaId) {
    const a = await asignarEnDependencia(db, dependenciaId)
    if (a?.usuarioId) return a
    // si la dependencia dada no tiene ocupante, seguimos al fallback compartido pero
    // conservamos 'a' por si el fallback tampoco resuelve.
    const fallback = await fallbackServicioCompartido(db)
    return fallback ?? a
  }
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

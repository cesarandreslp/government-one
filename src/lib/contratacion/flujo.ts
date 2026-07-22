// flujo.ts — máquina de estados de Contratación (portada de personeriabuga, hallazgo del
// gating real incluido). El sistema BLOQUEA el avance si se salta un paso o si actúa quien no
// corresponde: la capacidad (contratacion:elaborar/revisar_juridica/concepto_juridico/
// supervisar/aprobar) dice qué TIPO de acción puede hacer alguien en general; la asignación
// (estructuradorId/abogadoAsignadoId del contrato) dice si es la persona correcta PARA ESTE
// contrato. Las dos condiciones se exigen juntas — solo con la capacidad no basta.

export type EstadoContrato =
  | "BORRADOR"
  | "EN_REVISION_JURIDICA"
  | "DEVUELTO_ESTRUCTURACION"
  | "PERFECCIONADO"
  | "SUSCRITO"
  | "EN_EJECUCION"
  | "SUSPENDIDO"
  | "TERMINADO"
  | "INCUMPLIDO"
  | "LIQUIDADO"

export const TRANSICIONES_CONTRATO: Record<EstadoContrato, EstadoContrato[]> = {
  BORRADOR: ["EN_REVISION_JURIDICA"],
  EN_REVISION_JURIDICA: ["PERFECCIONADO", "DEVUELTO_ESTRUCTURACION"],
  DEVUELTO_ESTRUCTURACION: ["EN_REVISION_JURIDICA"],
  PERFECCIONADO: ["SUSCRITO"],
  SUSCRITO: ["EN_EJECUCION"],
  EN_EJECUCION: ["SUSPENDIDO", "TERMINADO", "INCUMPLIDO", "LIQUIDADO"],
  SUSPENDIDO: ["EN_EJECUCION", "TERMINADO"],
  TERMINADO: [],
  INCUMPLIDO: [],
  LIQUIDADO: [],
}

export const ETAPA_LABEL: Record<EstadoContrato, string> = {
  BORRADOR: "Borrador (estructuración)",
  EN_REVISION_JURIDICA: "En revisión jurídica",
  DEVUELTO_ESTRUCTURACION: "Devuelto a estructuración",
  PERFECCIONADO: "Perfeccionado",
  SUSCRITO: "Suscrito",
  EN_EJECUCION: "En ejecución",
  SUSPENDIDO: "Suspendido",
  TERMINADO: "Terminado",
  INCUMPLIDO: "Incumplido",
  LIQUIDADO: "Liquidado",
}

export function esTransicionValida(desde: EstadoContrato, hacia: EstadoContrato): boolean {
  return TRANSICIONES_CONTRATO[desde]?.includes(hacia) ?? false
}

interface ContratoParaGating {
  estructuradorId: string | null
  abogadoAsignadoId: string | null
}

interface ActorGating {
  usuarioId: string
  esAdminTenant: boolean // ADMIN/SUPER_ADMIN de identidad — override de soporte, igual que en personeriabuga
  puedeElaborar: boolean // capacidad contratacion:elaborar
  puedeRevisarJuridica: boolean // capacidad contratacion:revisar_juridica
  puedeConceptoJuridico: boolean // capacidad contratacion:concepto_juridico (el "jefe")
  puedeAprobar: boolean // capacidad contratacion:aprobar
  puedeSupervisar: boolean // capacidad contratacion:supervisar
}

/**
 * ¿Puede este actor mover el contrato de `desde` a `hacia`? Combina la transición válida en
 * abstracto (`esTransicionValida`) con el gating por persona/capacidad concreto de cada paso.
 * Devuelve un mensaje de error si no puede, o `null` si sí puede.
 */
export function puedeAvanzarContrato(
  contrato: ContratoParaGating,
  desde: EstadoContrato,
  hacia: EstadoContrato,
  actor: ActorGating,
): string | null {
  if (!esTransicionValida(desde, hacia)) return `No se puede pasar de "${ETAPA_LABEL[desde]}" a "${ETAPA_LABEL[hacia]}".`
  if (actor.esAdminTenant) return null // override de soporte, como en personeriabuga

  if (desde === "BORRADOR" || desde === "DEVUELTO_ESTRUCTURACION") {
    if (!actor.puedeElaborar) return "No tienes la capacidad para estructurar contratos."
    if (contrato.estructuradorId && actor.usuarioId !== contrato.estructuradorId) {
      return "Solo el estructurador asignado a este contrato puede enviarlo a revisión jurídica."
    }
    return null
  }

  if (desde === "EN_REVISION_JURIDICA") {
    if (!actor.puedeRevisarJuridica) return "No tienes la capacidad de revisión jurídica."
    if (!contrato.abogadoAsignadoId) return "El contrato aún no tiene abogado asignado."
    if (actor.usuarioId !== contrato.abogadoAsignadoId) return "Solo el abogado asignado a este contrato puede responder la revisión."
    return null
  }

  if (desde === "PERFECCIONADO" && hacia === "SUSCRITO") {
    return actor.puedeAprobar ? null : "No tienes la capacidad para suscribir contratos."
  }

  if (desde === "SUSCRITO" && hacia === "EN_EJECUCION") {
    return actor.puedeAprobar || actor.puedeSupervisar ? null : "No tienes la capacidad para iniciar la ejecución."
  }

  if (desde === "EN_EJECUCION" || desde === "SUSPENDIDO") {
    return actor.puedeSupervisar || actor.puedeAprobar ? null : "No tienes la capacidad para gestionar la ejecución del contrato."
  }

  return "Transición sin regla de gating definida."
}

"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede, ROLES_ADMIN_TENANT } from "@/lib/dal-tenant"
import { tieneCapacidad } from "@/lib/dominio/acceso"
import { puedeAvanzarContrato, type EstadoContrato } from "@/lib/contratacion/flujo"

// Acciones de CONTRATACIÓN (Ley 80/1150). Máquina de estados con gating REAL POR PERSONA: la
// capacidad (contratacion:elaborar/revisar_juridica/concepto_juridico/supervisar/aprobar) dice
// qué tipo de acción puede hacer alguien; la asignación (estructuradorId/abogadoAsignadoId del
// contrato) dice si es la persona correcta para ESE contrato. Ver src/lib/contratacion/flujo.ts.

const MODULO = "contratacion"
const MODALIDADES = ["LICITACION_PUBLICA", "SELECCION_ABREVIADA", "CONCURSO_MERITOS", "CONTRATACION_DIRECTA", "MINIMA_CUANTIA"]

export interface ConState {
  ok?: boolean
  error?: string
  mensaje?: string
}

async function construirActor(ctx: Awaited<ReturnType<typeof requerirFuncionario>>) {
  const [puedeElaborar, puedeRevisarJuridica, puedeConceptoJuridico, puedeAprobar, puedeSupervisar] = await Promise.all([
    funcionarioPuede(ctx, MODULO, "elaborar"),
    funcionarioPuede(ctx, MODULO, "revisar_juridica"),
    funcionarioPuede(ctx, MODULO, "concepto_juridico"),
    funcionarioPuede(ctx, MODULO, "aprobar"),
    funcionarioPuede(ctx, MODULO, "supervisar"),
  ])
  return {
    usuarioId: ctx.sesion.usuarioId,
    esAdminTenant: ROLES_ADMIN_TENANT.includes(ctx.sesion.rol),
    puedeElaborar, puedeRevisarJuridica, puedeConceptoJuridico, puedeAprobar, puedeSupervisar,
  }
}

export async function crearContratoAction(_prev: ConState, formData: FormData): Promise<ConState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "elaborar"))) {
    return { ok: false, error: "No tienes la capacidad para estructurar contratos." }
  }
  const objeto = String(formData.get("objeto") ?? "").trim()
  const modalidad = String(formData.get("modalidad") ?? "").trim()
  const valorContrato = Number(formData.get("valorContrato"))
  const terceroId = String(formData.get("terceroId") ?? "").trim()
  const estructuradorId = String(formData.get("estructuradorId") ?? "").trim()
  const vigencia = Number.parseInt(String(formData.get("vigencia") ?? ""), 10)
  const plazoDiasRaw = String(formData.get("plazoDias") ?? "").trim()
  const plazoDias = plazoDiasRaw === "" ? null : Number.parseInt(plazoDiasRaw, 10)

  if (!objeto) return { ok: false, error: "El objeto es obligatorio." }
  if (!MODALIDADES.includes(modalidad)) return { ok: false, error: "Modalidad inválida." }
  if (!Number.isFinite(valorContrato) || valorContrato <= 0) return { ok: false, error: "El valor debe ser mayor a 0." }
  if (!terceroId) return { ok: false, error: "Selecciona el contratista." }
  if (!estructuradorId) return { ok: false, error: "Selecciona el estructurador asignado." }
  if (!Number.isFinite(vigencia) || vigencia < 2000 || vigencia > 2100) return { ok: false, error: "Vigencia inválida." }

  try {
    const contrato = await ctx.db.$transaction(async (tx) => {
      const cons = await tx.contratoConsecutivo.upsert({
        where: { vigencia },
        create: { vigencia, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const numero = `C-${vigencia}-${String(cons.ultimo).padStart(3, "0")}`
      return tx.contrato.create({
        data: {
          numero, vigencia, objeto, modalidad: modalidad as never, valorContrato, plazoDias,
          terceroId, estructuradorId, creadoPor: ctx.sesion.usuarioId,
        },
      })
    })
    revalidatePath("/admin/contratacion")
    return { ok: true, mensaje: `${contrato.numero} creado en BORRADOR.` }
  } catch {
    return { ok: false, error: "Error al crear el contrato." }
  }
}

export async function enviarRevisionAction(_prev: ConState, formData: FormData): Promise<ConState> {
  const ctx = await requerirFuncionario()
  const contratoId = String(formData.get("contratoId") ?? "").trim()
  const contenido = String(formData.get("contenido") ?? "").trim()
  if (!contratoId) return { ok: false, error: "Selecciona un contrato." }
  if (!contenido || contenido.length < 10) return { ok: false, error: "El contenido debe tener al menos 10 caracteres." }

  const contrato = await ctx.db.contrato.findUnique({ where: { id: contratoId } })
  if (!contrato) return { ok: false, error: "Contrato no encontrado." }

  const actor = await construirActor(ctx)
  const bloqueo = puedeAvanzarContrato(contrato, contrato.estado as EstadoContrato, "EN_REVISION_JURIDICA", actor)
  if (bloqueo) return { ok: false, error: bloqueo }

  try {
    await ctx.db.$transaction(async (tx) => {
      const ultima = await tx.contratoVersion.findFirst({ where: { contratoId }, orderBy: { numeroVersion: "desc" } })
      await tx.contratoVersion.create({
        data: { contratoId, numeroVersion: (ultima?.numeroVersion ?? 0) + 1, tipo: "BORRADOR_ESTRUCTURACION", contenido, autorId: ctx.sesion.usuarioId },
      })
      await tx.contrato.update({ where: { id: contratoId }, data: { estado: "EN_REVISION_JURIDICA" } })
    })
    revalidatePath("/admin/contratacion")
    return { ok: true, mensaje: `${contrato.numero} enviado a revisión jurídica.` }
  } catch {
    return { ok: false, error: "Error al enviar a revisión." }
  }
}

export async function asignarAbogadoAction(_prev: ConState, formData: FormData): Promise<ConState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "concepto_juridico"))) {
    return { ok: false, error: "Solo el jefe jurídico puede asignar el abogado revisor." }
  }
  const contratoId = String(formData.get("contratoId") ?? "").trim()
  const abogadoAsignadoId = String(formData.get("abogadoAsignadoId") ?? "").trim()
  if (!contratoId || !abogadoAsignadoId) return { ok: false, error: "Selecciona el contrato y el abogado." }

  const contrato = await ctx.db.contrato.findUnique({ where: { id: contratoId } })
  if (!contrato) return { ok: false, error: "Contrato no encontrado." }
  if (contrato.estado !== "BORRADOR" && contrato.estado !== "EN_REVISION_JURIDICA") {
    return { ok: false, error: "Solo se puede asignar abogado en BORRADOR o EN_REVISION_JURIDICA." }
  }
  const puedeRevisar = await tieneCapacidad(ctx.db, abogadoAsignadoId, MODULO, "revisar_juridica")
  if (!puedeRevisar) return { ok: false, error: "El usuario elegido no tiene la capacidad de revisión jurídica (por sí mismo, sin contar el override de admin)." }

  try {
    await ctx.db.contrato.update({ where: { id: contratoId }, data: { abogadoAsignadoId } })
    revalidatePath("/admin/contratacion")
    return { ok: true, mensaje: `Abogado asignado a ${contrato.numero}.` }
  } catch {
    return { ok: false, error: "Error al asignar el abogado." }
  }
}

export async function responderRevisionAction(_prev: ConState, formData: FormData): Promise<ConState> {
  const ctx = await requerirFuncionario()
  const contratoId = String(formData.get("contratoId") ?? "").trim()
  const aprobado = String(formData.get("decision") ?? "") === "aprobar"
  const observaciones = String(formData.get("observaciones") ?? "").trim()
  if (!contratoId) return { ok: false, error: "Selecciona un contrato." }
  if (observaciones.length < 5) return { ok: false, error: "Las observaciones deben tener al menos 5 caracteres." }

  const contrato = await ctx.db.contrato.findUnique({ where: { id: contratoId } })
  if (!contrato) return { ok: false, error: "Contrato no encontrado." }

  const destino: EstadoContrato = aprobado ? "PERFECCIONADO" : "DEVUELTO_ESTRUCTURACION"
  const actor = await construirActor(ctx)
  const bloqueo = puedeAvanzarContrato(contrato, contrato.estado as EstadoContrato, destino, actor)
  if (bloqueo) return { ok: false, error: bloqueo }

  try {
    await ctx.db.$transaction(async (tx) => {
      const ultima = await tx.contratoVersion.findFirst({ where: { contratoId }, orderBy: { numeroVersion: "desc" } })
      await tx.contratoVersion.create({
        data: { contratoId, numeroVersion: (ultima?.numeroVersion ?? 0) + 1, tipo: "REVISION_JURIDICA", aprobado, observaciones, autorId: ctx.sesion.usuarioId },
      })
      await tx.contrato.update({ where: { id: contratoId }, data: { estado: destino } })
    })
    revalidatePath("/admin/contratacion")
    return { ok: true, mensaje: `${contrato.numero} → ${destino}.` }
  } catch {
    return { ok: false, error: "Error al registrar la revisión." }
  }
}

export async function registrarRpAction(_prev: ConState, formData: FormData): Promise<ConState> {
  const ctx = await requerirFuncionario()
  const contratoId = String(formData.get("contratoId") ?? "").trim()
  const rpId = String(formData.get("rpId") ?? "").trim()
  if (!contratoId || !rpId) return { ok: false, error: "Selecciona el contrato y el RP." }

  const contrato = await ctx.db.contrato.findUnique({ where: { id: contratoId } })
  if (!contrato) return { ok: false, error: "Contrato no encontrado." }

  const actor = await construirActor(ctx)
  const bloqueo = puedeAvanzarContrato(contrato, contrato.estado as EstadoContrato, "RP_REGISTRADO", actor)
  if (bloqueo) return { ok: false, error: bloqueo }

  // Respaldo presupuestal real (Art. 71 Decreto 111/1996): el RP debe existir, estar vigente y
  // cubrir el valor del contrato — sin esto no hay compromiso presupuestal válido.
  const rp = await ctx.db.rp.findUnique({ where: { id: rpId } })
  if (!rp) return { ok: false, error: "RP no encontrado." }
  if (rp.estado !== "VIGENTE") return { ok: false, error: `El ${rp.numero} no está vigente.` }
  if (Number(rp.valor) < Number(contrato.valorContrato)) {
    return { ok: false, error: `El ${rp.numero} ($${Number(rp.valor).toLocaleString()}) no cubre el valor del contrato ($${Number(contrato.valorContrato).toLocaleString()}).` }
  }

  try {
    await ctx.db.contrato.update({ where: { id: contratoId }, data: { estado: "RP_REGISTRADO", rpId } })
    revalidatePath("/admin/contratacion")
    return { ok: true, mensaje: `${rp.numero} registrado en ${contrato.numero}.` }
  } catch {
    return { ok: false, error: "Error al registrar el RP." }
  }
}

const DESTINOS_SIMPLES: Record<string, EstadoContrato> = {
  suscribir: "SUSCRITO",
  iniciar_ejecucion: "EN_EJECUCION",
  suspender: "SUSPENDIDO",
  terminar: "TERMINADO",
  incumplir: "INCUMPLIDO",
  liquidar: "LIQUIDADO",
  reanudar: "EN_EJECUCION",
}

export async function avanzarSimpleAction(_prev: ConState, formData: FormData): Promise<ConState> {
  const ctx = await requerirFuncionario()
  const contratoId = String(formData.get("contratoId") ?? "").trim()
  const accion = String(formData.get("accion") ?? "").trim()
  const destino = DESTINOS_SIMPLES[accion]
  if (!contratoId || !destino) return { ok: false, error: "Acción inválida." }

  const contrato = await ctx.db.contrato.findUnique({ where: { id: contratoId } })
  if (!contrato) return { ok: false, error: "Contrato no encontrado." }

  const actor = await construirActor(ctx)
  const bloqueo = puedeAvanzarContrato(contrato, contrato.estado as EstadoContrato, destino, actor)
  if (bloqueo) return { ok: false, error: bloqueo }

  try {
    await ctx.db.contrato.update({
      where: { id: contratoId },
      data: { estado: destino, fechaSuscripcion: destino === "SUSCRITO" ? new Date() : undefined },
    })
    revalidatePath("/admin/contratacion")
    return { ok: true, mensaje: `${contrato.numero} → ${destino}.` }
  } catch {
    return { ok: false, error: "Error al cambiar el estado." }
  }
}

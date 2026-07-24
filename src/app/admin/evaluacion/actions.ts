"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { quienEjerce } from "@/lib/dominio/acceso"

// Evaluación del Desempeño Laboral (EDL). Gateada por capacidad `evaluacion_desempeno`
// (consultar/evaluar). El evaluador se DERIVA del cargo (Cargo.jefeInmediatoId → quienEjerce) —
// la misma fundación de dominio que ya rutea Ventanilla Única — nunca se elige a mano.
//
// La calificación NO se calcula aquí: la realiza el evaluador en la plataforma de la Función
// Pública; el funcionario la imprime y la entrega físicamente a Talento Humano, que la
// TRANSCRIBE y la DIGITALIZA (registrarResultadoAction). El nivel derivado localmente (misma
// escala oficial CNSC) es solo una verificación cruzada de la transcripción.

const MODULO = "evaluacion_desempeno"

export interface EvalState {
  ok?: boolean
  error?: string
  mensaje?: string
}

function nivelDe(calificacion: number): "SOBRESALIENTE" | "DESTACADO" | "SATISFACTORIO" | "NO_SATISFACTORIO" {
  if (calificacion >= 90) return "SOBRESALIENTE"
  if (calificacion >= 75) return "DESTACADO"
  if (calificacion >= 60) return "SATISFACTORIO"
  return "NO_SATISFACTORIO"
}

export async function establecerAcuerdoAction(_prev: EvalState, formData: FormData): Promise<EvalState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "evaluar"))) return { ok: false, error: "No tienes la capacidad para gestionar Evaluación del Desempeño." }

  const usuarioId = String(formData.get("usuarioId") ?? "").trim()
  const periodo = String(formData.get("periodo") ?? "").trim()
  const fechaInicio = String(formData.get("fechaInicio") ?? "").trim()
  const fechaFin = String(formData.get("fechaFin") ?? "").trim()
  const compromisos = String(formData.get("compromisos") ?? "").trim()

  if (!usuarioId || !periodo || !fechaInicio || !fechaFin || !compromisos) return { ok: false, error: "Todos los campos son obligatorios." }
  if (new Date(fechaFin) <= new Date(fechaInicio)) return { ok: false, error: "La fecha fin debe ser posterior a la fecha inicio." }

  const yaExiste = await ctx.db.evaluacionDesempeno.findUnique({ where: { usuarioId_periodo: { usuarioId, periodo } } })
  if (yaExiste) return { ok: false, error: `Ya existe un acuerdo de gestión ${periodo} para este funcionario.` }

  // Evaluador = quien ejerce el cargo jefeInmediato del cargo vigente del evaluado.
  const vigente = await ctx.db.vinculacionCargo.findFirst({
    where: { usuarioId, desde: { lte: new Date() }, OR: [{ hasta: null }, { hasta: { gte: new Date() } }] },
    include: { cargo: true },
    orderBy: { desde: "desc" },
  })
  let evaluadorId: string | null = null
  if (vigente?.cargo.jefeInmediatoId) {
    const ejerce = await quienEjerce(ctx.db, vigente.cargo.jefeInmediatoId)
    evaluadorId = ejerce?.usuarioId ?? null
  }

  try {
    await ctx.db.evaluacionDesempeno.create({
      data: {
        usuarioId, evaluadorId, periodo, fechaInicio: new Date(fechaInicio), fechaFin: new Date(fechaFin),
        compromisos, creadoPor: ctx.sesion.usuarioId,
      },
    })
    revalidatePath("/admin/evaluacion")
    return { ok: true, mensaje: evaluadorId ? "Acuerdo de gestión establecido — evaluador derivado del jefe inmediato." : "Acuerdo de gestión establecido — sin jefe inmediato definido para este cargo, se podrá calificar igual." }
  } catch {
    return { ok: false, error: "Error al establecer el acuerdo de gestión." }
  }
}

/** Registra y digitaliza el resultado que la Función Pública ya calificó — Talento Humano lo
 * transcribe del documento impreso que el funcionario entrega, no lo calcula. */
export async function registrarResultadoAction(_prev: EvalState, formData: FormData): Promise<EvalState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "evaluar"))) return { ok: false, error: "No tienes la capacidad para gestionar Evaluación del Desempeño." }

  const evaluacionId = String(formData.get("evaluacionId") ?? "").trim()
  const calificacion = Number(formData.get("calificacion"))
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null
  const documentoUrl = String(formData.get("documentoUrl") ?? "").trim() || null

  if (!evaluacionId) return { ok: false, error: "Selecciona el acuerdo de gestión." }
  if (!Number.isFinite(calificacion) || calificacion < 0 || calificacion > 100) return { ok: false, error: "La calificación debe estar entre 0 y 100 (tal como aparece en el documento impreso)." }

  const evaluacion = await ctx.db.evaluacionDesempeno.findUnique({ where: { id: evaluacionId } })
  if (!evaluacion) return { ok: false, error: "Acuerdo de gestión no encontrado." }
  if (evaluacion.estado === "CALIFICADA") return { ok: false, error: "El resultado de este acuerdo ya fue registrado." }

  try {
    await ctx.db.evaluacionDesempeno.update({
      where: { id: evaluacionId },
      data: {
        estado: "CALIFICADA", calificacion, nivel: nivelDe(calificacion), observaciones, documentoUrl,
        fechaCalificacion: new Date(), calificadoPor: ctx.sesion.usuarioId,
      },
    })
    revalidatePath("/admin/evaluacion")
    return { ok: true, mensaje: `Resultado registrado: ${calificacion} (${nivelDe(calificacion)}).${documentoUrl ? " Documento digitalizado adjunto." : ""}` }
  } catch {
    return { ok: false, error: "Error al registrar el resultado." }
  }
}

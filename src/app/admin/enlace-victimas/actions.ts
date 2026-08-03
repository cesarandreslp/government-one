"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

// Enlace de Víctimas: el RUV es nacional (Unidad para las Víctimas), no se construye acá. Lo
// municipal real es la Ayuda Humanitaria Inmediata (AHI) ante un hecho victimizante reciente —
// SÍ nominal (a diferencia de Gestión del Riesgo), reusa `Tercero` para la identidad.

const MODULO = "enlace_victimas"
const HECHOS = ["DESPLAZAMIENTO", "AMENAZA", "HOMICIDIO", "DESAPARICION_FORZADA", "MINA_ANTIPERSONAL", "OTRO"]
const TIPOS_DOC = ["CC", "CE", "NIT", "PASAPORTE"]

export interface VictState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function crearPersonaAction(_prev: VictState, formData: FormData): Promise<VictState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Enlace de Víctimas." }

  const documento = String(formData.get("documento") ?? "").trim()
  const tipoDocumento = String(formData.get("tipoDocumento") ?? "CC").trim()
  const razonSocial = String(formData.get("razonSocial") ?? "").trim()

  if (!documento || !razonSocial) return { ok: false, error: "Documento y nombre son obligatorios." }
  if (!TIPOS_DOC.includes(tipoDocumento)) return { ok: false, error: "Tipo de documento inválido." }

  try {
    await ctx.db.tercero.create({ data: { documento, tipoDocumento: tipoDocumento as never, razonSocial } })
    revalidatePath("/admin/enlace-victimas")
    return { ok: true, mensaje: `Persona "${razonSocial}" creada.` }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique") ? `Ya existe una persona con documento "${documento}".` : "Error al crear la persona."
    return { ok: false, error: msg }
  }
}

export async function registrarAhiAction(_prev: VictState, formData: FormData): Promise<VictState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Enlace de Víctimas." }

  const personaId = String(formData.get("personaId") ?? "").trim()
  const hechoVictimizante = String(formData.get("hechoVictimizante") ?? "").trim()
  const fechaHecho = String(formData.get("fechaHecho") ?? "").trim()
  const fechaEntrega = String(formData.get("fechaEntrega") ?? "").trim()
  const tipoAyuda = String(formData.get("tipoAyuda") ?? "").trim()
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null

  if (!personaId || !fechaHecho || !fechaEntrega || !tipoAyuda) return { ok: false, error: "Persona, fechas y tipo de ayuda son obligatorios." }
  if (!HECHOS.includes(hechoVictimizante)) return { ok: false, error: "Hecho victimizante inválido." }
  if (new Date(fechaEntrega) < new Date(fechaHecho)) return { ok: false, error: "La entrega no puede ser anterior al hecho." }

  try {
    await ctx.db.ahiEntrega.create({
      data: {
        personaId, hechoVictimizante: hechoVictimizante as never,
        fechaHecho: new Date(fechaHecho), fechaEntrega: new Date(fechaEntrega),
        tipoAyuda, descripcion, registradoPor: ctx.sesion.usuarioId,
      },
    })
    revalidatePath("/admin/enlace-victimas")
    return { ok: true, mensaje: "Ayuda Humanitaria Inmediata registrada." }
  } catch {
    return { ok: false, error: "Error al registrar la ayuda (¿persona válida?)." }
  }
}

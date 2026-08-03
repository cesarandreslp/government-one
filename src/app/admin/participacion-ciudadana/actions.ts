"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

// Participación Ciudadana y Acción Comunal: registro de Juntas de Acción Comunal (Ley 743/2002),
// la organización + sus dignatarios por período (4 años). Dignatarios REUSAN `Tercero` (igual que
// Rentas/SISBEN — no se duplica identidad).

const MODULO = "participacion_ciudadana"
const CARGOS = ["PRESIDENTE", "VICEPRESIDENTE", "SECRETARIO", "TESORERO", "FISCAL", "VOCAL"]
const TIPOS_DOC = ["CC", "CE", "NIT", "PASAPORTE"]

export interface PartState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function crearPersonaAction(_prev: PartState, formData: FormData): Promise<PartState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Participación Ciudadana." }

  const documento = String(formData.get("documento") ?? "").trim()
  const tipoDocumento = String(formData.get("tipoDocumento") ?? "CC").trim()
  const razonSocial = String(formData.get("razonSocial") ?? "").trim()

  if (!documento || !razonSocial) return { ok: false, error: "Documento y nombre son obligatorios." }
  if (!TIPOS_DOC.includes(tipoDocumento)) return { ok: false, error: "Tipo de documento inválido." }

  try {
    await ctx.db.tercero.create({ data: { documento, tipoDocumento: tipoDocumento as never, razonSocial } })
    revalidatePath("/admin/participacion-ciudadana")
    return { ok: true, mensaje: `Persona "${razonSocial}" creada.` }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique") ? `Ya existe una persona con documento "${documento}".` : "Error al crear la persona."
    return { ok: false, error: msg }
  }
}

export async function crearJacAction(_prev: PartState, formData: FormData): Promise<PartState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Participación Ciudadana." }

  const nombre = String(formData.get("nombre") ?? "").trim()
  const barrioVereda = String(formData.get("barrioVereda") ?? "").trim()
  const personeriaJuridica = String(formData.get("personeriaJuridica") ?? "").trim() || null
  const fechaPersoneriaRaw = String(formData.get("fechaPersoneria") ?? "").trim()
  const fechaPersoneria = fechaPersoneriaRaw ? new Date(fechaPersoneriaRaw) : null

  if (!nombre || !barrioVereda) return { ok: false, error: "Nombre y barrio/vereda son obligatorios." }

  try {
    const jac = await ctx.db.jac.create({ data: { nombre, barrioVereda, personeriaJuridica, fechaPersoneria } })
    revalidatePath("/admin/participacion-ciudadana")
    return { ok: true, mensaje: `JAC "${jac.nombre}" creada.` }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique") ? "Ya existe una JAC con esa personería jurídica." : "Error al crear la JAC."
    return { ok: false, error: msg }
  }
}

export async function actualizarEstadoJacAction(_prev: PartState, formData: FormData): Promise<PartState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Participación Ciudadana." }

  const jacId = String(formData.get("jacId") ?? "").trim()
  const estado = String(formData.get("estado") ?? "").trim()
  if (!jacId) return { ok: false, error: "Selecciona una JAC." }
  if (estado !== "ACTIVA" && estado !== "INACTIVA") return { ok: false, error: "Estado inválido." }

  try {
    const jac = await ctx.db.jac.update({ where: { id: jacId }, data: { estado: estado as never } })
    revalidatePath("/admin/participacion-ciudadana")
    return { ok: true, mensaje: `JAC "${jac.nombre}" marcada como ${estado}.` }
  } catch {
    return { ok: false, error: "Error al actualizar el estado." }
  }
}

export async function crearDignatarioAction(_prev: PartState, formData: FormData): Promise<PartState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Participación Ciudadana." }

  const jacId = String(formData.get("jacId") ?? "").trim()
  const personaId = String(formData.get("personaId") ?? "").trim()
  const cargo = String(formData.get("cargo") ?? "").trim()
  const periodoInicio = String(formData.get("periodoInicio") ?? "").trim()
  const periodoFin = String(formData.get("periodoFin") ?? "").trim()
  const actoEleccion = String(formData.get("actoEleccion") ?? "").trim() || null

  if (!jacId || !personaId || !periodoInicio || !periodoFin) return { ok: false, error: "JAC, persona y período son obligatorios." }
  if (!CARGOS.includes(cargo)) return { ok: false, error: "Cargo de dignatario inválido." }
  if (new Date(periodoFin) <= new Date(periodoInicio)) return { ok: false, error: "El fin del período debe ser posterior al inicio." }

  try {
    const dignatario = await ctx.db.jacDignatario.create({
      data: {
        jacId, personaId, cargo: cargo as never,
        periodoInicio: new Date(periodoInicio), periodoFin: new Date(periodoFin),
        actoEleccion, registradoPor: ctx.sesion.usuarioId,
      },
    })
    revalidatePath("/admin/participacion-ciudadana")
    return { ok: true, mensaje: `Dignatario registrado (${dignatario.cargo}).` }
  } catch {
    return { ok: false, error: "Error al registrar el dignatario (¿JAC/persona válidas?)." }
  }
}

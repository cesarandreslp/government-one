"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { crearPqrsd, PQRSD_TIPOS, PQRSD_CANALES } from "@/lib/pqrsd"
import { resolverAsignacionVu } from "@/lib/vu-ruteo"

// Acciones de VENTANILLA ÚNICA (PQRSD). Gateadas por CAPACIDAD ventanilla_unica (radicar/
// responder/asignar). Al radicar se AUTO-ASIGNA por ruteo de cargo (crearPqrsd →
// resolverAsignacionVu) — el ciudadano no elige dependencia, así que una PQRSD sin pistas cae en
// el servicio compartido (Atención al Ciudadano). "Derivar" corrige ese ruteo automático a mano
// cuando alguien lee el contenido y reconoce a qué dependencia compete de verdad.

const MODULO = "ventanilla_unica"
const TIPOS = PQRSD_TIPOS as readonly string[]
const CANALES = PQRSD_CANALES as readonly string[]
const CERRADAS = new Set(["RESPONDIDA", "CERRADA"])

export interface VuState {
  ok?: boolean
  error?: string
  mensaje?: string
}

function opt(formData: FormData, k: string): string | null {
  const v = String(formData.get(k) ?? "").trim()
  return v === "" ? null : v
}

export async function radicarPqrsdAction(_prev: VuState, formData: FormData): Promise<VuState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "radicar"))) {
    return { ok: false, error: "No tienes la capacidad para radicar en Ventanilla Única." }
  }
  const tipo = String(formData.get("tipo") ?? "").trim()
  const canal = String(formData.get("canal") ?? "PRESENCIAL").trim()
  const peticionarioNombre = String(formData.get("peticionarioNombre") ?? "").trim()
  const asunto = String(formData.get("asunto") ?? "").trim()
  const descripcion = String(formData.get("descripcion") ?? "").trim()
  const dependenciaId = opt(formData, "dependenciaId")

  if (!TIPOS.includes(tipo)) return { ok: false, error: "Tipo de PQRSD inválido." }
  if (!CANALES.includes(canal)) return { ok: false, error: "Canal inválido." }
  if (!peticionarioNombre || !asunto || !descripcion) {
    return { ok: false, error: "Nombre del peticionario, asunto y descripción son obligatorios." }
  }

  try {
    const p = await crearPqrsd(ctx.db, {
      tipo, canal, peticionarioNombre, asunto, descripcion, dependenciaId,
      peticionarioEmail: opt(formData, "peticionarioEmail"),
      peticionarioTelefono: opt(formData, "peticionarioTelefono"),
    })
    revalidatePath("/admin/vu")
    const dest = p.usuarioAsignadoId ? "asignada al funcionario que ejerce el cargo competente" : "recibida (sin ocupante del cargo; requiere asignación manual)"
    return { ok: true, mensaje: `${p.numero} creada y ${dest}.` }
  } catch {
    return { ok: false, error: "Error al radicar la PQRSD (reintenta; el consecutivo es atómico)." }
  }
}

export async function derivarPqrsdAction(_prev: VuState, formData: FormData): Promise<VuState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "asignar"))) {
    return { ok: false, error: "No tienes la capacidad para derivar PQRSD a otra dependencia." }
  }
  const id = String(formData.get("id") ?? "").trim()
  const dependenciaId = String(formData.get("dependenciaId") ?? "").trim()
  if (!id || !dependenciaId) return { ok: false, error: "Selecciona la PQRSD y la dependencia destino." }

  const actual = await ctx.db.pqrsd.findUnique({ where: { id } })
  if (!actual) return { ok: false, error: "PQRSD no encontrada." }
  if (CERRADAS.has(actual.estado)) return { ok: false, error: "No se puede derivar una PQRSD ya respondida o cerrada." }

  try {
    const asignacion = await resolverAsignacionVu(ctx.db, dependenciaId)
    const p = await ctx.db.pqrsd.update({
      where: { id },
      data: {
        dependenciaId: asignacion?.dependenciaId ?? dependenciaId,
        cargoAsignadoId: asignacion?.cargoId ?? null,
        usuarioAsignadoId: asignacion?.usuarioId ?? null,
        estado: asignacion?.usuarioId ? "ASIGNADA" : "RECIBIDA",
      },
    })
    revalidatePath("/admin/vu")
    const dest = p.usuarioAsignadoId ? "asignada al funcionario que ejerce el cargo competente" : "sin ocupante en esa dependencia; requiere asignación manual"
    return { ok: true, mensaje: `${p.numero} derivada — ${dest}.` }
  } catch {
    return { ok: false, error: "Error al derivar la PQRSD (¿dependencia válida?)." }
  }
}

export async function responderPqrsdAction(_prev: VuState, formData: FormData): Promise<VuState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "responder"))) {
    return { ok: false, error: "No tienes la capacidad para responder en Ventanilla Única." }
  }
  const id = String(formData.get("id") ?? "").trim()
  const respuesta = String(formData.get("respuesta") ?? "").trim()
  if (!id || respuesta.length < 5) return { ok: false, error: "Selecciona una PQRSD y escribe la respuesta (≥5 caracteres)." }

  try {
    const p = await ctx.db.pqrsd.update({
      where: { id },
      data: {
        estado: "RESPONDIDA",
        respuesta,
        fechaRespuesta: new Date(),
        respondidoPorId: ctx.sesion.usuarioId,
      },
    })
    revalidatePath("/admin/vu")
    return { ok: true, mensaje: `${p.numero} respondida.` }
  } catch {
    return { ok: false, error: "Error al responder la PQRSD." }
  }
}

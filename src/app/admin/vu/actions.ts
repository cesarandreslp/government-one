"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { resolverAsignacionVu } from "@/lib/vu-ruteo"
import { sumarDiasHabiles } from "@/lib/dias-habiles"

// Acciones de VENTANILLA ÚNICA (PQRSD). Gateadas por CAPACIDAD ventanilla_unica (radicar/
// responder). Al radicar se AUTO-ASIGNA por ruteo de cargo (resolverAsignacionVu → quienEjerce).

const MODULO = "ventanilla_unica"
const TIPOS = ["PETICION", "QUEJA", "RECLAMO", "SUGERENCIA", "DENUNCIA"]
const CANALES = ["WEB", "PRESENCIAL", "TELEFONICO", "EMAIL", "ESCRITO"]

// Término de ley en días hábiles por tipo (simplificado; petición de info/consulta afinan luego).
const TERMINO_DIAS: Record<string, number> = {
  PETICION: 15,
  QUEJA: 15,
  RECLAMO: 15,
  SUGERENCIA: 15,
  DENUNCIA: 15,
}

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

  const anio = new Date().getFullYear()
  const diasTermino = TERMINO_DIAS[tipo]
  const fechaRecepcion = new Date()
  const fechaVencimiento = sumarDiasHabiles(fechaRecepcion, diasTermino)

  // Ruteo por cargo: resuelve el funcionario que EJERCE el cargo competente hoy.
  const asignacion = await resolverAsignacionVu(ctx.db, dependenciaId)

  try {
    const p = await ctx.db.$transaction(async (tx) => {
      const cons = await tx.pqrsdConsecutivo.upsert({
        where: { anio },
        create: { anio, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const numero = `PQRSD-${anio}-${String(cons.ultimo).padStart(6, "0")}`
      return tx.pqrsd.create({
        data: {
          numero,
          anio,
          consecutivo: cons.ultimo,
          tipo: tipo as never,
          canal: canal as never,
          estado: asignacion?.usuarioId ? "ASIGNADA" : "RECIBIDA",
          peticionarioNombre,
          peticionarioEmail: opt(formData, "peticionarioEmail"),
          peticionarioTelefono: opt(formData, "peticionarioTelefono"),
          asunto,
          descripcion,
          dependenciaId: asignacion?.dependenciaId ?? dependenciaId,
          cargoAsignadoId: asignacion?.cargoId ?? null,
          usuarioAsignadoId: asignacion?.usuarioId ?? null,
          diasTermino,
          fechaRecepcion,
          fechaVencimiento,
        },
      })
    })
    revalidatePath("/admin/vu")
    const dest = asignacion?.usuarioId ? "asignada al funcionario que ejerce el cargo competente" : "recibida (sin ocupante del cargo; requiere asignación manual)"
    return { ok: true, mensaje: `${p.numero} creada y ${dest}.` }
  } catch {
    return { ok: false, error: "Error al radicar la PQRSD (reintenta; el consecutivo es atómico)." }
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

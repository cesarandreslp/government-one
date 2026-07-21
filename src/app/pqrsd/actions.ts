"use server"

import { contextoTenant } from "@/lib/contexto-tenant"
import { crearPqrsd, PQRSD_TIPOS } from "@/lib/pqrsd"

// Acciones PÚBLICAS del portal (sin sesión). Resuelven el tenant por HOST. El ciudadano radica
// su PQRSD → cae en la Ventanilla Única del tenant (auto-asignada por ruteo de cargo).

const TIPOS = PQRSD_TIPOS as readonly string[]

export interface RadicarPublicoState {
  ok?: boolean
  error?: string
  numero?: string
}

export async function radicarPublicoAction(_prev: RadicarPublicoState, formData: FormData): Promise<RadicarPublicoState> {
  const ctx = await contextoTenant()
  if (!ctx) return { ok: false, error: "Esta dirección no corresponde a ninguna entidad." }

  const tipo = String(formData.get("tipo") ?? "").trim()
  const peticionarioNombre = String(formData.get("peticionarioNombre") ?? "").trim()
  const asunto = String(formData.get("asunto") ?? "").trim()
  const descripcion = String(formData.get("descripcion") ?? "").trim()
  const email = String(formData.get("peticionarioEmail") ?? "").trim() || null
  const telefono = String(formData.get("peticionarioTelefono") ?? "").trim() || null

  if (!TIPOS.includes(tipo)) return { ok: false, error: "Selecciona un tipo de solicitud válido." }
  if (!peticionarioNombre || !asunto || descripcion.length < 10) {
    return { ok: false, error: "Nombre, asunto y una descripción (≥10 caracteres) son obligatorios." }
  }

  try {
    const p = await crearPqrsd(ctx.db, {
      tipo,
      canal: "WEB",
      peticionarioNombre,
      peticionarioEmail: email,
      peticionarioTelefono: telefono,
      asunto,
      descripcion,
    })
    return { ok: true, numero: p.numero }
  } catch {
    return { ok: false, error: "No se pudo radicar en este momento. Intenta de nuevo." }
  }
}

export interface ConsultaState {
  error?: string
  encontrada?: {
    numero: string
    tipo: string
    estado: string
    fechaRecepcion: string
    fechaVencimiento: string
    respuesta: string | null
  }
}

export async function consultarPublicoAction(_prev: ConsultaState, formData: FormData): Promise<ConsultaState> {
  const ctx = await contextoTenant()
  if (!ctx) return { error: "Esta dirección no corresponde a ninguna entidad." }

  const numero = String(formData.get("numero") ?? "").trim().toUpperCase()
  if (!numero) return { error: "Ingresa el número de radicado." }

  const p = await ctx.db.pqrsd.findUnique({ where: { numero } })
  if (!p) return { error: `No se encontró el radicado "${numero}".` }

  return {
    encontrada: {
      numero: p.numero,
      tipo: p.tipo,
      estado: p.estado,
      fechaRecepcion: p.fechaRecepcion.toISOString().slice(0, 10),
      fechaVencimiento: p.fechaVencimiento.toISOString().slice(0, 10),
      respuesta: p.estado === "RESPONDIDA" ? p.respuesta : null,
    },
  }
}

"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

// Acciones de GESTIÓN DOCUMENTAL. Gateadas por CAPACIDAD de módulo (fundación de dominio):
// administrar_trd para la TRD, radicar para radicar, archivar para cambiar estado. Los admins
// del tenant pasan siempre (ver funcionarioPuede). Nada mira el rol para funciones de módulo.

const MODULO = "gestion_documental"
const TIPOS = ["ENTRADA", "SALIDA", "INTERNO"]
const ESTADOS = ["RADICADO", "EN_TRAMITE", "RESPONDIDO", "ARCHIVADO", "ANULADO"]
const DISPOSICIONES = ["CONSERVACION_TOTAL", "ELIMINACION", "SELECCION", "DIGITALIZACION"]
const PREFIJO: Record<string, string> = { ENTRADA: "E", SALIDA: "S", INTERNO: "I" }

export interface GdState {
  ok?: boolean
  error?: string
  mensaje?: string
}

function opt(formData: FormData, k: string): string | null {
  const v = String(formData.get(k) ?? "").trim()
  return v === "" ? null : v
}
function optInt(formData: FormData, k: string): number | null {
  const v = opt(formData, k)
  if (v === null) return null
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

export async function crearSerieAction(_prev: GdState, formData: FormData): Promise<GdState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar_trd"))) {
    return { ok: false, error: "No tienes la capacidad para administrar la TRD." }
  }
  const dependenciaId = String(formData.get("dependenciaId") ?? "").trim()
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase()
  const nombre = String(formData.get("nombre") ?? "").trim()
  if (!dependenciaId || !codigo || !nombre) return { ok: false, error: "Dependencia, código y nombre son obligatorios." }

  try {
    await ctx.db.gdSerie.create({ data: { dependenciaId, codigo, nombre } })
    revalidatePath("/admin/gd")
    return { ok: true, mensaje: `Serie "${codigo} · ${nombre}" creada.` }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique") ? `Ya existe una serie con código "${codigo}" en esa dependencia.` : "Error al crear la serie."
    return { ok: false, error: msg }
  }
}

export async function crearSubserieAction(_prev: GdState, formData: FormData): Promise<GdState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar_trd"))) {
    return { ok: false, error: "No tienes la capacidad para administrar la TRD." }
  }
  const serieId = String(formData.get("serieId") ?? "").trim()
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase()
  const nombre = String(formData.get("nombre") ?? "").trim()
  const disposicion = opt(formData, "disposicion")
  if (!serieId || !codigo || !nombre) return { ok: false, error: "Serie, código y nombre son obligatorios." }
  if (disposicion && !DISPOSICIONES.includes(disposicion)) return { ok: false, error: "Disposición inválida." }

  try {
    await ctx.db.gdSubserie.create({
      data: {
        serieId,
        codigo,
        nombre,
        retencionGestion: optInt(formData, "retencionGestion"),
        retencionCentral: optInt(formData, "retencionCentral"),
        disposicion: (disposicion as never) ?? null,
      },
    })
    revalidatePath("/admin/gd")
    return { ok: true, mensaje: `Subserie "${codigo} · ${nombre}" creada.` }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique") ? `Ya existe una subserie con código "${codigo}" en esa serie.` : "Error al crear la subserie."
    return { ok: false, error: msg }
  }
}

export async function radicarAction(_prev: GdState, formData: FormData): Promise<GdState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "radicar"))) {
    return { ok: false, error: "No tienes la capacidad para radicar." }
  }
  const tipo = String(formData.get("tipo") ?? "").trim()
  const asunto = String(formData.get("asunto") ?? "").trim()
  const tercero = opt(formData, "tercero")
  const dependenciaId = opt(formData, "dependenciaId")
  const subserieId = opt(formData, "subserieId")
  if (!TIPOS.includes(tipo)) return { ok: false, error: "Tipo de radicado inválido." }
  if (!asunto) return { ok: false, error: "El asunto es obligatorio." }

  const anio = new Date().getFullYear()
  try {
    const radicado = await ctx.db.$transaction(async (tx) => {
      // Consecutivo atómico por (tipo, año): incrementa y usa el nuevo valor.
      const cons = await tx.gdConsecutivo.upsert({
        where: { tipo_anio: { tipo: tipo as never, anio } },
        create: { tipo: tipo as never, anio, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const numero = `${PREFIJO[tipo]}-${anio}-${String(cons.ultimo).padStart(6, "0")}`
      return tx.radicado.create({
        data: {
          numero,
          tipo: tipo as never,
          anio,
          consecutivo: cons.ultimo,
          asunto,
          tercero,
          dependenciaId,
          subserieId,
          radicadoPorId: ctx.sesion.usuarioId,
        },
      })
    })
    revalidatePath("/admin/gd")
    return { ok: true, mensaje: `Radicado ${radicado.numero} creado.` }
  } catch {
    return { ok: false, error: "Error al radicar (reintenta; el consecutivo es atómico)." }
  }
}

export async function cambiarEstadoAction(_prev: GdState, formData: FormData): Promise<GdState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "archivar"))) {
    return { ok: false, error: "No tienes la capacidad para archivar/cambiar estado." }
  }
  const id = String(formData.get("id") ?? "").trim()
  const estado = String(formData.get("estado") ?? "").trim()
  if (!id || !ESTADOS.includes(estado)) return { ok: false, error: "Radicado o estado inválido." }

  try {
    await ctx.db.radicado.update({ where: { id }, data: { estado: estado as never } })
    revalidatePath("/admin/gd")
    return { ok: true, mensaje: `Radicado actualizado a ${estado}.` }
  } catch {
    return { ok: false, error: "Error al cambiar el estado." }
  }
}

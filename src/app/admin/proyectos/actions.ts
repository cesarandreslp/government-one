"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

// Acciones de BANCO DE PROYECTOS. Un proyecto tiene ejecución FINANCIERA (derivada de los CDP
// vinculados vía Cdp.proyectoId, ver src/lib/proyectos/ejecucion.ts) y ejecución FÍSICA (hitos
// ponderados, reportados aquí). Gateadas por CAPACIDAD banco_proyectos: administrar (crear
// proyecto/hito) y reportar_avance (reportar hitos). Admins del tenant pasan siempre.

const MODULO = "banco_proyectos"
const ESTADOS = ["FORMULACION", "EJECUCION", "SUSPENDIDO", "CERRADO"]

export interface BpState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function crearProyectoAction(_prev: BpState, formData: FormData): Promise<BpState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) {
    return { ok: false, error: "No tienes la capacidad para administrar el banco de proyectos." }
  }
  const nombre = String(formData.get("nombre") ?? "").trim()
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null
  const vigencia = Number.parseInt(String(formData.get("vigencia") ?? ""), 10)
  const dependenciaId = String(formData.get("dependenciaId") ?? "").trim()
  const valorTotalRaw = String(formData.get("valorTotal") ?? "").trim()
  const valorTotal = valorTotalRaw === "" ? null : Number(valorTotalRaw)

  if (!nombre) return { ok: false, error: "El nombre es obligatorio." }
  if (!dependenciaId) return { ok: false, error: "Selecciona una dependencia responsable." }
  if (!Number.isFinite(vigencia) || vigencia < 2000 || vigencia > 2100) return { ok: false, error: "Vigencia inválida." }
  if (valorTotalRaw !== "" && (!Number.isFinite(valorTotal) || (valorTotal as number) < 0)) return { ok: false, error: "Valor total inválido." }

  const dependencia = await ctx.db.dependencia.findUnique({ where: { id: dependenciaId } })
  if (!dependencia) return { ok: false, error: "Dependencia no encontrada." }

  try {
    const proyecto = await ctx.db.$transaction(async (tx) => {
      const cons = await tx.proyectoConsecutivo.upsert({
        where: { vigencia },
        create: { vigencia, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const codigo = `PRY-${vigencia}-${String(cons.ultimo).padStart(3, "0")}`
      return tx.proyecto.create({
        data: { codigo, nombre, descripcion, vigencia, dependenciaId, valorTotal, creadoPor: ctx.sesion.usuarioId },
      })
    })
    revalidatePath("/admin/proyectos")
    return { ok: true, mensaje: `${proyecto.codigo} "${proyecto.nombre}" creado.` }
  } catch {
    return { ok: false, error: "Error al crear el proyecto." }
  }
}

export async function crearHitoAction(_prev: BpState, formData: FormData): Promise<BpState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) {
    return { ok: false, error: "No tienes la capacidad para administrar el banco de proyectos." }
  }
  const proyectoId = String(formData.get("proyectoId") ?? "").trim()
  const nombre = String(formData.get("nombre") ?? "").trim()
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null
  const pesoPorcentual = Number(formData.get("pesoPorcentual"))

  if (!proyectoId) return { ok: false, error: "Selecciona un proyecto." }
  if (!nombre) return { ok: false, error: "El nombre del hito es obligatorio." }
  if (!Number.isFinite(pesoPorcentual) || pesoPorcentual <= 0 || pesoPorcentual > 100) return { ok: false, error: "El peso debe estar entre 1 y 100." }

  const proyecto = await ctx.db.proyecto.findUnique({ where: { id: proyectoId } })
  if (!proyecto) return { ok: false, error: "Proyecto no encontrado." }

  try {
    const hito = await ctx.db.proyectoHito.create({ data: { proyectoId, nombre, descripcion, pesoPorcentual } })
    revalidatePath("/admin/proyectos")
    return { ok: true, mensaje: `Hito "${hito.nombre}" (${pesoPorcentual}%) creado en ${proyecto.codigo}.` }
  } catch {
    return { ok: false, error: "Error al crear el hito." }
  }
}

export async function reportarAvanceAction(_prev: BpState, formData: FormData): Promise<BpState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "reportar_avance"))) {
    return { ok: false, error: "No tienes la capacidad para reportar avance físico." }
  }
  const hitoId = String(formData.get("hitoId") ?? "").trim()
  const avancePorcentual = Number(formData.get("avancePorcentual"))
  const evidenciaUrl = String(formData.get("evidenciaUrl") ?? "").trim() || null
  const observacion = String(formData.get("observacion") ?? "").trim() || null

  if (!hitoId) return { ok: false, error: "Selecciona un hito." }
  if (!Number.isFinite(avancePorcentual) || avancePorcentual < 0 || avancePorcentual > 100) return { ok: false, error: "El avance debe estar entre 0 y 100." }

  const hito = await ctx.db.proyectoHito.findUnique({ where: { id: hitoId } })
  if (!hito) return { ok: false, error: "Hito no encontrado." }

  try {
    await ctx.db.$transaction(async (tx) => {
      await tx.proyectoHitoReporte.create({ data: { hitoId, avancePorcentual, evidenciaUrl, observacion, reportadoPor: ctx.sesion.usuarioId } })
      await tx.proyectoHito.update({
        where: { id: hitoId },
        data: { avancePorcentual, fechaReporte: new Date(), reportadoPor: ctx.sesion.usuarioId, evidenciaUrl, observacion },
      })
    })
    revalidatePath("/admin/proyectos")
    return { ok: true, mensaje: `Avance de "${hito.nombre}" actualizado a ${avancePorcentual}%.` }
  } catch {
    return { ok: false, error: "Error al reportar el avance." }
  }
}

export async function cambiarEstadoProyectoAction(_prev: BpState, formData: FormData): Promise<BpState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) {
    return { ok: false, error: "No tienes la capacidad para administrar el banco de proyectos." }
  }
  const proyectoId = String(formData.get("proyectoId") ?? "").trim()
  const estado = String(formData.get("estado") ?? "").trim()
  if (!proyectoId || !ESTADOS.includes(estado)) return { ok: false, error: "Datos inválidos." }

  try {
    const proyecto = await ctx.db.proyecto.update({ where: { id: proyectoId }, data: { estado: estado as never } })
    revalidatePath("/admin/proyectos")
    return { ok: true, mensaje: `${proyecto.codigo} → ${estado}.` }
  } catch {
    return { ok: false, error: "Error al cambiar el estado." }
  }
}

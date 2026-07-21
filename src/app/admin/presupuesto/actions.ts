"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { aplicarClasificacionPresupuestal } from "@/lib/presupuesto/ccpet"

// Acciones de PRESUPUESTO (CDP → RP → Obligación → Pago). Este corte cubre Rubro (CCPET) +
// Apropiación (vigencia) + CDP con validación de saldo disponible. Gateadas por CAPACIDAD
// presupuesto: administrar (rubros/apropiaciones) y expedir_cdp (CDP). Admins del tenant pasan
// siempre (funcionarioPuede).

const MODULO = "presupuesto"

export interface PspState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function sembrarClasificacionAction(): Promise<PspState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) {
    return { ok: false, error: "No tienes la capacidad para administrar presupuesto." }
  }
  try {
    const r = await aplicarClasificacionPresupuestal(ctx.db)
    revalidatePath("/admin/presupuesto")
    return { ok: true, mensaje: `Clasificación CCPET sembrada: ${r.total} rubros.` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al sembrar la clasificación presupuestal." }
  }
}

export async function crearApropiacionAction(_prev: PspState, formData: FormData): Promise<PspState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) {
    return { ok: false, error: "No tienes la capacidad para administrar presupuesto." }
  }
  const rubroId = String(formData.get("rubroId") ?? "").trim()
  const vigencia = Number.parseInt(String(formData.get("vigencia") ?? ""), 10)
  const apropiacionInicial = Number(formData.get("apropiacionInicial"))

  if (!rubroId) return { ok: false, error: "Selecciona un rubro." }
  if (!Number.isFinite(vigencia) || vigencia < 2000 || vigencia > 2100) return { ok: false, error: "Vigencia inválida." }
  if (!Number.isFinite(apropiacionInicial) || apropiacionInicial <= 0) return { ok: false, error: "La apropiación inicial debe ser mayor a 0." }

  const rubro = await ctx.db.rubroPresupuestal.findUnique({ where: { id: rubroId } })
  if (!rubro) return { ok: false, error: "Rubro no encontrado." }
  if (!rubro.permiteMovimientos) return { ok: false, error: `El rubro ${rubro.codigo} no acepta apropiaciones (no es hoja del CCPET).` }
  if (rubro.tipo !== "GASTO") return { ok: false, error: "Solo los rubros de GASTO llevan apropiación (los de INGRESO se aforan, no se apropian)." }

  try {
    await ctx.db.apropiacion.upsert({
      where: { rubroId_vigencia: { rubroId, vigencia } },
      create: { rubroId, vigencia, apropiacionInicial },
      update: { apropiacionInicial },
    })
    revalidatePath("/admin/presupuesto")
    return { ok: true, mensaje: `Apropiación ${vigencia} de ${rubro.codigo} guardada: $${apropiacionInicial.toLocaleString()}.` }
  } catch {
    return { ok: false, error: "Error al guardar la apropiación." }
  }
}

export async function expedirCdpAction(_prev: PspState, formData: FormData): Promise<PspState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "expedir_cdp"))) {
    return { ok: false, error: "No tienes la capacidad para expedir CDP." }
  }
  const rubroId = String(formData.get("rubroId") ?? "").trim()
  const vigencia = Number.parseInt(String(formData.get("vigencia") ?? ""), 10)
  const fecha = String(formData.get("fecha") ?? "").trim()
  const objeto = String(formData.get("objeto") ?? "").trim()
  const valor = Number(formData.get("valor"))

  if (!rubroId) return { ok: false, error: "Selecciona un rubro." }
  if (!Number.isFinite(vigencia) || vigencia < 2000 || vigencia > 2100) return { ok: false, error: "Vigencia inválida." }
  if (!fecha || !objeto) return { ok: false, error: "Fecha y objeto son obligatorios." }
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, error: "El valor debe ser mayor a 0." }

  const rubro = await ctx.db.rubroPresupuestal.findUnique({ where: { id: rubroId } })
  if (!rubro) return { ok: false, error: "Rubro no encontrado." }
  if (!rubro.activo || !rubro.permiteMovimientos) return { ok: false, error: `El rubro ${rubro.codigo} no acepta CDP.` }

  const apropiacion = await ctx.db.apropiacion.findUnique({ where: { rubroId_vigencia: { rubroId, vigencia } } })
  if (!apropiacion) return { ok: false, error: `No hay apropiación ${vigencia} para el rubro ${rubro.codigo}.` }

  const cdpsVigentes = await ctx.db.cdp.findMany({ where: { rubroId, vigencia, estado: "VIGENTE" }, select: { valor: true } })
  const comprometido = cdpsVigentes.reduce((s, c) => s + Number(c.valor), 0)
  const totalApropiado = Number(apropiacion.apropiacionInicial) + Number(apropiacion.adiciones) - Number(apropiacion.reducciones)
  const disponible = totalApropiado - comprometido

  if (valor > disponible + 0.5) {
    return { ok: false, error: `No hay saldo suficiente: disponible $${disponible.toLocaleString()}, solicitado $${valor.toLocaleString()}.` }
  }

  try {
    const cdp = await ctx.db.$transaction(async (tx) => {
      const cons = await tx.cdpConsecutivo.upsert({
        where: { vigencia },
        create: { vigencia, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const numero = `CDP-${vigencia}-${String(cons.ultimo).padStart(6, "0")}`
      return tx.cdp.create({
        data: { numero, fecha: new Date(fecha), vigencia, rubroId, valor, objeto, creadoPor: ctx.sesion.usuarioId },
      })
    })
    revalidatePath("/admin/presupuesto")
    return { ok: true, mensaje: `${cdp.numero} expedido · $${valor.toLocaleString()} · disponible restante $${(disponible - valor).toLocaleString()}.` }
  } catch {
    return { ok: false, error: "Error al expedir el CDP." }
  }
}

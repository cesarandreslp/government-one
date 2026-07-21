"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { aplicarPlanCuentas } from "@/lib/contabilidad/cgc"

// Acciones de CONTABILIDAD (libro mayor, doble partida). Gateadas por CAPACIDAD contabilidad:
// administrar (plan de cuentas / periodos / terceros) y registrar (comprobantes). Admins del
// tenant pasan siempre (funcionarioPuede). El motor valida ∑débitos = ∑créditos por comprobante.

const MODULO = "contabilidad"
const TIPOS_COMPROBANTE = ["CONTABLE", "EGRESO", "INGRESO", "AJUSTE", "APERTURA", "CIERRE"]
const TIPOS_DOC = ["NIT", "CC", "CE", "PA", "OTRO"]
const PREFIJO: Record<string, string> = { CONTABLE: "CC", EGRESO: "CE", INGRESO: "CI", AJUSTE: "CA", APERTURA: "CAP", CIERRE: "CIE" }

export interface CpState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function sembrarPlanCuentasAction(): Promise<CpState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) {
    return { ok: false, error: "No tienes la capacidad para administrar contabilidad." }
  }
  try {
    const r = await aplicarPlanCuentas(ctx.db)
    revalidatePath("/admin/contabilidad")
    return { ok: true, mensaje: `Plan de cuentas CGC sembrado: ${r.total} cuentas.` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al sembrar el plan de cuentas." }
  }
}

export async function crearPeriodoAction(_prev: CpState, formData: FormData): Promise<CpState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) {
    return { ok: false, error: "No tienes la capacidad para administrar contabilidad." }
  }
  const anio = Number.parseInt(String(formData.get("anio") ?? ""), 10)
  const mesRaw = String(formData.get("mes") ?? "").trim()
  const mes = mesRaw === "" ? null : Number.parseInt(mesRaw, 10)
  if (!Number.isFinite(anio) || anio < 2000 || anio > 2100) return { ok: false, error: "Año inválido." }
  if (mes !== null && (!Number.isFinite(mes) || mes < 1 || mes > 12)) return { ok: false, error: "Mes inválido." }

  const codigo = mes === null ? String(anio) : `${anio}-${String(mes).padStart(2, "0")}`
  const fechaInicio = mes === null ? new Date(Date.UTC(anio, 0, 1)) : new Date(Date.UTC(anio, mes - 1, 1))
  const fechaFin = mes === null ? new Date(Date.UTC(anio, 11, 31)) : new Date(Date.UTC(anio, mes, 0))

  try {
    await ctx.db.periodoContable.create({ data: { codigo, anio, mes, fechaInicio, fechaFin } })
    revalidatePath("/admin/contabilidad")
    return { ok: true, mensaje: `Periodo ${codigo} creado (ABIERTO).` }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique") ? `El periodo ${codigo} ya existe.` : "Error al crear el periodo."
    return { ok: false, error: msg }
  }
}

export async function crearTerceroAction(_prev: CpState, formData: FormData): Promise<CpState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) {
    return { ok: false, error: "No tienes la capacidad para administrar contabilidad." }
  }
  const documento = String(formData.get("documento") ?? "").trim()
  const tipoDocumento = String(formData.get("tipoDocumento") ?? "NIT").trim()
  const razonSocial = String(formData.get("razonSocial") ?? "").trim()
  if (!documento || !razonSocial) return { ok: false, error: "Documento y razón social son obligatorios." }
  if (!TIPOS_DOC.includes(tipoDocumento)) return { ok: false, error: "Tipo de documento inválido." }

  try {
    await ctx.db.tercero.create({ data: { documento, tipoDocumento: tipoDocumento as never, razonSocial } })
    revalidatePath("/admin/contabilidad")
    return { ok: true, mensaje: `Tercero "${razonSocial}" creado.` }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique") ? `Ya existe un tercero con documento "${documento}".` : "Error al crear el tercero."
    return { ok: false, error: msg }
  }
}

interface AsientoInput {
  cuentaId?: string
  terceroId?: string | null
  debito?: number
  credito?: number
  descripcion?: string | null
}

export async function registrarComprobanteAction(_prev: CpState, formData: FormData): Promise<CpState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "registrar"))) {
    return { ok: false, error: "No tienes la capacidad para registrar comprobantes." }
  }
  const tipo = String(formData.get("tipo") ?? "CONTABLE").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()
  const descripcion = String(formData.get("descripcion") ?? "").trim()
  const periodoId = String(formData.get("periodoId") ?? "").trim()

  if (!TIPOS_COMPROBANTE.includes(tipo)) return { ok: false, error: "Tipo de comprobante inválido." }
  if (!fecha || !descripcion || !periodoId) return { ok: false, error: "Fecha, descripción y periodo son obligatorios." }

  let asientos: AsientoInput[]
  try {
    asientos = JSON.parse(String(formData.get("asientos") ?? "[]"))
  } catch {
    return { ok: false, error: "Asientos inválidos." }
  }
  // Normaliza y valida cada línea: exactamente uno de débito/crédito > 0.
  const lineas = asientos
    .map((a) => ({ cuentaId: String(a.cuentaId ?? ""), terceroId: a.terceroId || null, debito: Number(a.debito) || 0, credito: Number(a.credito) || 0, descripcion: a.descripcion || null }))
    .filter((a) => a.cuentaId && (a.debito > 0 || a.credito > 0))
  if (lineas.length < 2) return { ok: false, error: "Un comprobante requiere al menos 2 asientos." }
  for (const a of lineas) {
    if ((a.debito > 0 && a.credito > 0) || (a.debito === 0 && a.credito === 0)) {
      return { ok: false, error: "Cada asiento debe tener débito O crédito (no ambos)." }
    }
  }

  const totalDebito = lineas.reduce((s, a) => s + a.debito, 0)
  const totalCredito = lineas.reduce((s, a) => s + a.credito, 0)
  if (Math.abs(totalDebito - totalCredito) > 0.5) {
    return { ok: false, error: `No cuadra: débitos $${totalDebito.toLocaleString()} ≠ créditos $${totalCredito.toLocaleString()}.` }
  }

  // Periodo: ABIERTO (o AJUSTE solo administración).
  const periodo = await ctx.db.periodoContable.findUnique({ where: { id: periodoId } })
  if (!periodo) return { ok: false, error: "Periodo no encontrado." }
  if (periodo.estado === "CERRADO") return { ok: false, error: "El periodo está CERRADO." }
  if (periodo.estado === "AJUSTE" && !(await funcionarioPuede(ctx, MODULO, "administrar"))) {
    return { ok: false, error: "Solo administración puede mover periodos en AJUSTE." }
  }

  // Cuentas: existen, activas y permiten movimientos.
  const cuentaIds = [...new Set(lineas.map((a) => a.cuentaId))]
  const cuentas = await ctx.db.planCuenta.findMany({ where: { id: { in: cuentaIds } }, select: { id: true, codigo: true, activa: true, permiteMovimientos: true } })
  if (cuentas.length !== cuentaIds.length) return { ok: false, error: "Alguna cuenta no existe." }
  const bloqueada = cuentas.find((c) => !c.activa || !c.permiteMovimientos)
  if (bloqueada) return { ok: false, error: `La cuenta ${bloqueada.codigo} no acepta movimientos.` }

  const anio = new Date(fecha).getUTCFullYear()
  try {
    const comp = await ctx.db.$transaction(async (tx) => {
      const cons = await tx.comprobanteConsecutivo.upsert({
        where: { tipo_anio: { tipo: tipo as never, anio } },
        create: { tipo: tipo as never, anio, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const numero = `${PREFIJO[tipo]}-${anio}-${String(cons.ultimo).padStart(6, "0")}`
      return tx.comprobante.create({
        data: {
          numero, tipo: tipo as never, fecha: new Date(fecha), descripcion, periodoId, anio, consecutivo: cons.ultimo,
          totalDebito, totalCredito, creadoPor: ctx.sesion.usuarioId,
          asientos: { create: lineas.map((a) => ({ cuentaId: a.cuentaId, terceroId: a.terceroId, debito: a.debito, credito: a.credito, descripcion: a.descripcion })) },
        },
      })
    })
    revalidatePath("/admin/contabilidad")
    return { ok: true, mensaje: `Comprobante ${comp.numero} registrado · $${totalDebito.toLocaleString()} (cuadra).` }
  } catch {
    return { ok: false, error: "Error al registrar el comprobante." }
  }
}

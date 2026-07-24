"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

// Acciones de TESORERÍA. Gateadas por capacidad `tesoreria` (consultar/administrar/conciliar).
// "Registrar movimiento" es la ÚNICA vía de captura nueva que agrega este módulo (recaudo directo,
// rendimientos financieros, traslados entre cuentas propias) — y postea un Comprobante real, igual
// que Presupuesto/Nómina, para que nunca exista un movimiento de banco fuera del libro mayor.

const MODULO = "tesoreria"
const TIPOS_CUENTA = ["CORRIENTE", "AHORROS", "INVERSION_TEMPORAL", "FONDOS_ESPECIALES"]

export interface TesoState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function crearCuentaAction(_prev: TesoState, formData: FormData): Promise<TesoState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) {
    return { ok: false, error: "No tienes la capacidad para administrar Tesorería." }
  }
  const nombre = String(formData.get("nombre") ?? "").trim()
  const banco = String(formData.get("banco") ?? "").trim()
  const nitBanco = String(formData.get("nitBanco") ?? "").trim() || null
  const numeroCuenta = String(formData.get("numeroCuenta") ?? "").trim()
  const tipo = String(formData.get("tipo") ?? "CORRIENTE").trim()
  const cuentaContableId = String(formData.get("cuentaContableId") ?? "").trim()

  if (!nombre || !banco || !numeroCuenta || !cuentaContableId) return { ok: false, error: "Nombre, banco, número de cuenta y cuenta contable son obligatorios." }
  if (!TIPOS_CUENTA.includes(tipo)) return { ok: false, error: "Tipo de cuenta inválido." }

  const cuentaContable = await ctx.db.planCuenta.findUnique({ where: { id: cuentaContableId } })
  if (!cuentaContable?.permiteMovimientos) return { ok: false, error: "La cuenta contable seleccionada no es válida." }

  try {
    await ctx.db.tesoCuenta.create({ data: { nombre, banco, nitBanco, numeroCuenta, tipo: tipo as never, cuentaContableId } })
    revalidatePath("/admin/tesoreria")
    return { ok: true, mensaje: `Cuenta "${nombre}" creada.` }
  } catch {
    return { ok: false, error: "Error al crear la cuenta." }
  }
}

export async function registrarMovimientoAction(_prev: TesoState, formData: FormData): Promise<TesoState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) {
    return { ok: false, error: "No tienes la capacidad para registrar movimientos." }
  }
  const cuentaId = String(formData.get("cuentaId") ?? "").trim()
  const tipo = String(formData.get("tipo") ?? "").trim() // INGRESO | EGRESO
  const fecha = String(formData.get("fecha") ?? "").trim()
  const valor = Number(formData.get("valor"))
  const concepto = String(formData.get("concepto") ?? "").trim()
  const cuentaContraId = String(formData.get("cuentaContraId") ?? "").trim()

  if (!cuentaId || !fecha || !concepto || !cuentaContraId) return { ok: false, error: "Cuenta, fecha, concepto y cuenta contrapartida son obligatorios." }
  if (tipo !== "INGRESO" && tipo !== "EGRESO") return { ok: false, error: "Tipo inválido." }
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, error: "El valor debe ser mayor a 0." }

  const [cuenta, cuentaContra] = await Promise.all([
    ctx.db.tesoCuenta.findUnique({ where: { id: cuentaId }, include: { cuentaContable: true } }),
    ctx.db.planCuenta.findUnique({ where: { id: cuentaContraId } }),
  ])
  if (!cuenta) return { ok: false, error: "Cuenta bancaria no encontrada." }
  if (!cuentaContra?.permiteMovimientos) return { ok: false, error: "Cuenta contrapartida inválida." }

  const anio = new Date(fecha).getUTCFullYear()
  const periodoContable = await ctx.db.periodoContable.findFirst({ where: { estado: "ABIERTO" }, orderBy: [{ anio: "desc" }, { mes: "desc" }] })
  if (!periodoContable) return { ok: false, error: "No hay periodo contable ABIERTO para generar el comprobante." }

  try {
    await ctx.db.$transaction(async (tx) => {
      const cons = await tx.comprobanteConsecutivo.upsert({
        where: { tipo_anio: { tipo: tipo as never, anio } },
        create: { tipo: tipo as never, anio, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const prefijo = tipo === "INGRESO" ? "CI" : "CE"
      const numero = `${prefijo}-${anio}-${String(cons.ultimo).padStart(6, "0")}`
      const asientos = tipo === "INGRESO"
        ? [
            { cuentaId: cuenta.cuentaContableId, debito: valor, credito: 0, descripcion: concepto },
            { cuentaId: cuentaContraId, debito: 0, credito: valor, descripcion: concepto },
          ]
        : [
            { cuentaId: cuentaContraId, debito: valor, credito: 0, descripcion: concepto },
            { cuentaId: cuenta.cuentaContableId, debito: 0, credito: valor, descripcion: concepto },
          ]
      await tx.comprobante.create({
        data: {
          numero, tipo: tipo as never, fecha: new Date(fecha), descripcion: concepto,
          periodoId: periodoContable.id, anio, consecutivo: cons.ultimo, totalDebito: valor, totalCredito: valor,
          fuenteModulo: "tesoreria", creadoPor: ctx.sesion.usuarioId,
          asientos: { create: asientos },
        },
      })
    })
    revalidatePath("/admin/tesoreria")
    revalidatePath("/admin/contabilidad")
    return { ok: true, mensaje: `Movimiento registrado — $${valor.toLocaleString()}.` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al registrar el movimiento." }
  }
}

export async function cargarExtractoAction(_prev: TesoState, formData: FormData): Promise<TesoState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "conciliar"))) {
    return { ok: false, error: "No tienes la capacidad para cargar extractos." }
  }
  const cuentaId = String(formData.get("cuentaId") ?? "").trim()
  const periodo = String(formData.get("periodo") ?? "").trim() // "2026-07"
  const saldoInicial = Number(formData.get("saldoInicial"))
  const saldoFinal = Number(formData.get("saldoFinal"))
  const lineasRaw = String(formData.get("lineas") ?? "").trim()

  if (!cuentaId || !/^\d{4}-\d{2}$/.test(periodo)) return { ok: false, error: "Cuenta y periodo (AAAA-MM) son obligatorios." }
  if (!Number.isFinite(saldoInicial) || !Number.isFinite(saldoFinal)) return { ok: false, error: "Saldo inicial y final deben ser números." }
  if (!lineasRaw) return { ok: false, error: "Pega o escribe al menos una línea del extracto." }

  const lineas: { fecha: Date; descripcion: string; referencia: string | null; debito: number | null; credito: number | null; saldo: number | null }[] = []
  for (const [i, raw] of lineasRaw.split("\n").entries()) {
    const linea = raw.trim()
    if (!linea) continue
    const cols = linea.split(",").map((c) => c.trim())
    if (cols.length < 2) return { ok: false, error: `Línea ${i + 1} inválida: formato esperado fecha,descripcion,referencia,debito,credito,saldo` }
    const [fechaRaw, descripcion, referencia, debitoRaw, creditoRaw, saldoRaw] = cols
    const fecha = new Date(fechaRaw)
    if (Number.isNaN(fecha.getTime())) return { ok: false, error: `Línea ${i + 1}: fecha inválida "${fechaRaw}".` }
    lineas.push({
      fecha, descripcion: descripcion || "(sin descripción)", referencia: referencia || null,
      debito: debitoRaw ? Number(debitoRaw) : null, credito: creditoRaw ? Number(creditoRaw) : null,
      saldo: saldoRaw ? Number(saldoRaw) : null,
    })
  }
  if (lineas.length === 0) return { ok: false, error: "No se reconoció ninguna línea válida." }

  try {
    await ctx.db.tesoExtracto.create({
      data: { cuentaId, periodo, saldoInicial, saldoFinal, cargadoPor: ctx.sesion.usuarioId, lineas: { create: lineas } },
    })
    revalidatePath("/admin/tesoreria")
    return { ok: true, mensaje: `Extracto ${periodo} cargado: ${lineas.length} línea(s).` }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique") ? `Ya existe un extracto de esa cuenta para ${periodo}.` : "Error al cargar el extracto."
    return { ok: false, error: msg }
  }
}

export async function conciliarAction(_prev: TesoState, formData: FormData): Promise<TesoState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "conciliar"))) {
    return { ok: false, error: "No tienes la capacidad para conciliar." }
  }
  const cuentaId = String(formData.get("cuentaId") ?? "").trim()
  const asientoId = String(formData.get("asientoId") ?? "").trim()
  const extractoLineaIds = formData.getAll("extractoLineaIds").map(String).filter(Boolean)

  if (!cuentaId || !asientoId || extractoLineaIds.length === 0) {
    return { ok: false, error: "Selecciona el movimiento y al menos una línea del extracto." }
  }

  const [asiento, lineas] = await Promise.all([
    ctx.db.asiento.findUnique({ where: { id: asientoId } }),
    ctx.db.tesoExtractoLinea.findMany({ where: { id: { in: extractoLineaIds } } }),
  ])
  if (!asiento) return { ok: false, error: "Movimiento no encontrado." }
  if (lineas.length !== extractoLineaIds.length) return { ok: false, error: "Alguna línea del extracto no existe." }

  const valorAsiento = Number(asiento.debito) > 0 ? Number(asiento.debito) : Number(asiento.credito)
  const sumaLineas = lineas.reduce((s, l) => s + (Number(l.debito ?? 0) || Number(l.credito ?? 0)), 0)
  if (Math.abs(valorAsiento - sumaLineas) > 1) {
    return { ok: false, error: `No cuadra: movimiento $${valorAsiento.toLocaleString()} vs. líneas seleccionadas $${sumaLineas.toLocaleString()}.` }
  }

  try {
    await ctx.db.tesoConciliacion.create({
      data: {
        cuentaId, asientoId, conciliadoPor: ctx.sesion.usuarioId,
        lineas: { create: extractoLineaIds.map((extractoLineaId) => ({ extractoLineaId })) },
      },
    })
    revalidatePath("/admin/tesoreria")
    return { ok: true, mensaje: "Movimiento conciliado." }
  } catch {
    return { ok: false, error: "Error al conciliar (¿el movimiento o alguna línea ya estaban conciliados?)." }
  }
}

export async function revertirConciliacionAction(_prev: TesoState, formData: FormData): Promise<TesoState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "conciliar"))) {
    return { ok: false, error: "No tienes la capacidad para revertir conciliaciones." }
  }
  const asientoId = String(formData.get("asientoId") ?? "").trim()
  if (!asientoId) return { ok: false, error: "Falta el movimiento." }

  try {
    await ctx.db.tesoConciliacion.delete({ where: { asientoId } })
    revalidatePath("/admin/tesoreria")
    return { ok: true, mensaje: "Conciliación revertida." }
  } catch {
    return { ok: false, error: "Error al revertir (¿ya estaba sin conciliar?)." }
  }
}

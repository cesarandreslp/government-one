"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { sembrarConceptosNomina } from "@/lib/nomina/conceptos-seed"
import { empleadosLiquidables } from "@/lib/nomina/salario"
import { liquidar, type ConceptoLiquidable } from "@/lib/nomina/motor"

// Acciones de NÓMINA. Gateadas por capacidad `nomina` (consultar/liquidar/pagar). Liquidar corre
// el motor puro por cada funcionario con salario vigente (ver salario.ts); pagar postea UN
// comprobante agregado a Contabilidad (mismo patrón que Presupuesto → Pago → Comprobante).

const MODULO = "nomina"

export interface NomState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function sembrarConceptosAction(): Promise<NomState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "liquidar"))) {
    return { ok: false, error: "No tienes la capacidad para administrar Nómina." }
  }
  try {
    const r = await sembrarConceptosNomina(ctx.db)
    revalidatePath("/admin/nomina")
    return { ok: true, mensaje: `Catálogo de conceptos: ${r.conceptos} nuevo(s).` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al sembrar los conceptos." }
  }
}

export async function crearPeriodoAction(_prev: NomState, formData: FormData): Promise<NomState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "liquidar"))) {
    return { ok: false, error: "No tienes la capacidad para administrar Nómina." }
  }
  const codigo = String(formData.get("codigo") ?? "").trim() // "2026-05"
  const m = /^(\d{4})-(\d{2})$/.exec(codigo)
  if (!m) return { ok: false, error: "Formato inválido. Usa AAAA-MM (ej. 2026-05)." }
  const anio = Number(m[1])
  const mes = Number(m[2])
  if (mes < 1 || mes > 12) return { ok: false, error: "Mes inválido." }

  const fechaInicio = new Date(Date.UTC(anio, mes - 1, 1))
  const fechaFin = new Date(Date.UTC(anio, mes, 0, 23, 59, 59))

  try {
    await ctx.db.periodoNomina.create({ data: { codigo, anio, mes, fechaInicio, fechaFin } })
    revalidatePath("/admin/nomina")
    return { ok: true, mensaje: `Periodo ${codigo} creado.` }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique") ? `El periodo "${codigo}" ya existe.` : "Error al crear el periodo."
    return { ok: false, error: msg }
  }
}

export async function liquidarPeriodoAction(_prev: NomState, formData: FormData): Promise<NomState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "liquidar"))) {
    return { ok: false, error: "No tienes la capacidad para liquidar Nómina." }
  }
  const periodoId = String(formData.get("periodoId") ?? "").trim()
  if (!periodoId) return { ok: false, error: "Selecciona el periodo." }

  const periodo = await ctx.db.periodoNomina.findUnique({ where: { id: periodoId } })
  if (!periodo) return { ok: false, error: "Periodo no encontrado." }
  if (periodo.estado !== "ABIERTO") return { ok: false, error: `El periodo ${periodo.codigo} ya no está ABIERTO.` }

  const conceptosDb = await ctx.db.conceptoNomina.findMany({ where: { activo: true } })
  if (conceptosDb.length === 0) return { ok: false, error: "No hay conceptos de nómina sembrados." }
  const conceptos: ConceptoLiquidable[] = conceptosDb.map((c) => ({
    id: c.id, tipo: c.tipo, formula: c.formula,
    porcentaje: c.porcentaje === null ? null : Number(c.porcentaje),
    valorFijo: c.valorFijo === null ? null : Number(c.valorFijo),
    constitutivoSalario: c.constitutivoSalario, orden: c.orden,
  }))

  const empleados = await empleadosLiquidables(ctx.db, periodo.fechaFin)
  if (empleados.length === 0) return { ok: false, error: "Ningún funcionario tiene salario asignado (RRHH lo fija al posesionar)." }

  try {
    await ctx.db.$transaction(async (tx) => {
      for (const emp of empleados) {
        const r = liquidar(emp.salarioBasico, conceptos)
        const liquidacion = await tx.liquidacionNomina.upsert({
          where: { periodoId_usuarioId: { periodoId, usuarioId: emp.usuarioId } },
          create: {
            periodoId, usuarioId: emp.usuarioId, salarioBasico: emp.salarioBasico,
            totalDevengado: r.totalDevengado, totalDeducciones: r.totalDeducciones,
            totalAportesPatronales: r.totalAportesPatronales, netoPagar: r.netoPagar,
          },
          update: {
            salarioBasico: emp.salarioBasico, totalDevengado: r.totalDevengado, totalDeducciones: r.totalDeducciones,
            totalAportesPatronales: r.totalAportesPatronales, netoPagar: r.netoPagar,
          },
        })
        await tx.liquidacionNominaDetalle.deleteMany({ where: { liquidacionId: liquidacion.id } })
        await tx.liquidacionNominaDetalle.createMany({
          data: r.lineas.map((l) => ({ liquidacionId: liquidacion.id, conceptoId: l.conceptoId, valor: l.valor, base: l.base })),
        })
      }
      await tx.periodoNomina.update({ where: { id: periodoId }, data: { estado: "LIQUIDADO", liquidadoEn: new Date() } })
    })
    revalidatePath("/admin/nomina")
    return { ok: true, mensaje: `Periodo ${periodo.codigo} liquidado: ${empleados.length} funcionario(s).` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al liquidar el periodo." }
  }
}

const CUENTA_APORTES_PATRONALES = "250505"
const CUENTA_PRESTACIONES_SOCIALES = "250502"

export async function pagarPeriodoAction(_prev: NomState, formData: FormData): Promise<NomState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "pagar"))) {
    return { ok: false, error: "No tienes la capacidad para pagar Nómina." }
  }
  const periodoId = String(formData.get("periodoId") ?? "").trim()
  const cuentaBancoId = String(formData.get("cuentaBancoId") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()
  if (!periodoId || !cuentaBancoId || !fecha) return { ok: false, error: "Periodo, cuenta de banco y fecha son obligatorios." }

  const periodo = await ctx.db.periodoNomina.findUnique({ where: { id: periodoId } })
  if (!periodo) return { ok: false, error: "Periodo no encontrado." }
  if (periodo.estado !== "LIQUIDADO") return { ok: false, error: `El periodo ${periodo.codigo} no está LIQUIDADO.` }

  const liquidaciones = await ctx.db.liquidacionNomina.findMany({
    where: { periodoId }, include: { detalles: { include: { concepto: true } } },
  })
  if (liquidaciones.length === 0) return { ok: false, error: "El periodo no tiene liquidaciones." }

  // Agrega por concepto (un comprobante compacto para todo el periodo, no uno por empleado).
  const porConcepto = new Map<string, { concepto: (typeof liquidaciones)[0]["detalles"][0]["concepto"]; total: number }>()
  let netoTotal = 0
  for (const liq of liquidaciones) {
    netoTotal += Number(liq.netoPagar)
    for (const d of liq.detalles) {
      const acc = porConcepto.get(d.conceptoId) ?? { concepto: d.concepto, total: 0 }
      acc.total += Number(d.valor)
      porConcepto.set(d.conceptoId, acc)
    }
  }

  const codigosNecesarios = new Set<string>()
  for (const { concepto } of porConcepto.values()) {
    if (concepto.cuentaContableCodigo) codigosNecesarios.add(concepto.cuentaContableCodigo)
  }
  const hayAportesOPrestaciones = [...porConcepto.values()].some((v) => v.concepto.tipo === "APORTE_PATRONAL" || v.concepto.tipo === "PRESTACION_SOCIAL")
  if (hayAportesOPrestaciones) {
    codigosNecesarios.add(CUENTA_APORTES_PATRONALES)
    codigosNecesarios.add(CUENTA_PRESTACIONES_SOCIALES)
  }

  const [cuentas, cuentaBanco] = await Promise.all([
    ctx.db.planCuenta.findMany({ where: { codigo: { in: [...codigosNecesarios] } } }),
    ctx.db.planCuenta.findUnique({ where: { id: cuentaBancoId } }),
  ])
  if (!cuentaBanco?.permiteMovimientos) return { ok: false, error: "Cuenta de banco inválida." }
  const idPorCodigo = new Map(cuentas.map((c) => [c.codigo, c.id]))
  const faltantes = [...codigosNecesarios].filter((c) => !idPorCodigo.has(c))
  if (faltantes.length > 0) return { ok: false, error: `Faltan cuentas contables por sembrar: ${faltantes.join(", ")}.` }

  const anio = new Date(fecha).getUTCFullYear()
  const periodoContable = await ctx.db.periodoContable.findFirst({ where: { estado: "ABIERTO" }, orderBy: [{ anio: "desc" }, { mes: "desc" }] })
  if (!periodoContable) return { ok: false, error: "No hay periodo contable ABIERTO para generar el comprobante." }

  type LineaAsiento = { cuentaId: string; debito: number; credito: number; descripcion: string }
  const asientos: LineaAsiento[] = []
  for (const { concepto, total } of porConcepto.values()) {
    if (total <= 0 || !concepto.cuentaContableCodigo) continue
    const cuentaId = idPorCodigo.get(concepto.cuentaContableCodigo)!
    if (concepto.tipo === "DEVENGADO") {
      asientos.push({ cuentaId, debito: total, credito: 0, descripcion: concepto.nombre })
    } else if (concepto.tipo === "DEDUCCION") {
      asientos.push({ cuentaId, debito: 0, credito: total, descripcion: concepto.nombre })
    } else {
      // APORTE_PATRONAL / PRESTACION_SOCIAL: gasto propio + pasivo genérico por tipo.
      asientos.push({ cuentaId, debito: total, credito: 0, descripcion: concepto.nombre })
      const bucketCodigo = concepto.tipo === "PRESTACION_SOCIAL" ? CUENTA_PRESTACIONES_SOCIALES : CUENTA_APORTES_PATRONALES
      const bucketId = idPorCodigo.get(bucketCodigo)!
      const idx = asientos.findIndex((a) => a.cuentaId === bucketId && a.credito > 0 && a.debito === 0)
      if (idx >= 0) asientos[idx].credito += total
      else asientos.push({ cuentaId: bucketId, debito: 0, credito: total, descripcion: concepto.tipo === "PRESTACION_SOCIAL" ? "Prestaciones sociales por pagar" : "Aportes patronales por pagar" })
    }
  }
  asientos.push({ cuentaId: cuentaBancoId, debito: 0, credito: netoTotal, descripcion: "Neto pagado a funcionarios" })

  const totalDebito = asientos.reduce((s, a) => s + a.debito, 0)
  const totalCredito = asientos.reduce((s, a) => s + a.credito, 0)
  if (Math.abs(totalDebito - totalCredito) > 0.5) {
    return { ok: false, error: `El comprobante no cuadra: débito $${totalDebito.toLocaleString()} vs. crédito $${totalCredito.toLocaleString()}.` }
  }

  try {
    await ctx.db.$transaction(async (tx) => {
      const cons = await tx.comprobanteConsecutivo.upsert({
        where: { tipo_anio: { tipo: "EGRESO", anio } },
        create: { tipo: "EGRESO", anio, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const numero = `CE-${anio}-${String(cons.ultimo).padStart(6, "0")}`
      const comprobante = await tx.comprobante.create({
        data: {
          numero, tipo: "EGRESO", fecha: new Date(fecha), descripcion: `Pago de nómina — periodo ${periodo.codigo}`,
          periodoId: periodoContable.id, anio, consecutivo: cons.ultimo, totalDebito, totalCredito,
          fuenteModulo: "nomina", fuenteRef: periodo.id, creadoPor: ctx.sesion.usuarioId,
          asientos: { create: asientos },
        },
      })
      await tx.liquidacionNomina.updateMany({ where: { periodoId }, data: { comprobanteId: comprobante.id } })
      await tx.periodoNomina.update({ where: { id: periodoId }, data: { estado: "PAGADO", pagadoEn: new Date() } })
    })
    revalidatePath("/admin/nomina")
    revalidatePath("/admin/contabilidad")
    return { ok: true, mensaje: `Periodo ${periodo.codigo} pagado — comprobante contable generado por $${netoTotal.toLocaleString()}.` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al pagar el periodo." }
  }
}

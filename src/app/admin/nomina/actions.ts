"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { sembrarConceptosNomina } from "@/lib/nomina/conceptos-seed"
import { empleadosLiquidables } from "@/lib/nomina/salario"
import { liquidar, type ConceptoLiquidable } from "@/lib/nomina/motor"
import { obtenerUvt, fijarUvt } from "@/lib/nomina/parametro"
import { calcularNovedadPeriodo } from "@/lib/nomina/novedades"
import { generarArchivoPila, type EmpleadoPila } from "@/lib/nomina/pila"
import { saldosPasivosNomina } from "@/lib/nomina/pasivos"
import { prismaMeta } from "@/lib/prisma-meta"

// Acciones de NÓMINA. Gateadas por capacidad `nomina` (consultar/liquidar/pagar). Liquidar corre
// el motor puro por cada funcionario con salario vigente (ver salario.ts); pagar postea UN
// comprobante agregado a Contabilidad (mismo patrón que Presupuesto → Pago → Comprobante).

const MODULO = "nomina"

export interface NomState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export interface PilaState extends NomState {
  archivo?: string
  nombreArchivo?: string
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

/** Fija el UVT vigente (la DIAN lo publica cada diciembre para el año siguiente). */
export async function actualizarUvtAction(_prev: NomState, formData: FormData): Promise<NomState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "liquidar"))) {
    return { ok: false, error: "No tienes la capacidad para administrar Nómina." }
  }
  const uvt = Number(formData.get("uvt"))
  if (!Number.isFinite(uvt) || uvt <= 0) return { ok: false, error: "El UVT debe ser un número mayor a 0." }

  try {
    await fijarUvt(ctx.db, uvt)
    revalidatePath("/admin/nomina")
    return { ok: true, mensaje: `UVT actualizado a $${uvt.toLocaleString()}.` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al actualizar el UVT." }
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

  const uvt = await obtenerUvt(ctx.db)

  try {
    await ctx.db.$transaction(async (tx) => {
      for (const emp of empleados) {
        const ausencias = await tx.ausencia.findMany({
          where: { usuarioId: emp.usuarioId, desde: { lte: periodo.fechaFin }, hasta: { gte: periodo.fechaInicio } },
        })
        const novedad = calcularNovedadPeriodo(ausencias, periodo.fechaInicio, periodo.fechaFin)
        const r = liquidar(emp.salarioBasico, conceptos, { novedad, uvt })
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

/** Genera el archivo PILA (campos núcleo) de un periodo ya liquidado. Ver pila.ts para el alcance. */
export async function generarPilaAction(_prev: PilaState, formData: FormData): Promise<PilaState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "liquidar"))) {
    return { ok: false, error: "No tienes la capacidad para generar la PILA." }
  }
  const periodoId = String(formData.get("periodoId") ?? "").trim()
  if (!periodoId) return { ok: false, error: "Selecciona el periodo." }

  const periodo = await ctx.db.periodoNomina.findUnique({ where: { id: periodoId } })
  if (!periodo) return { ok: false, error: "Periodo no encontrado." }
  if (periodo.estado === "ABIERTO") return { ok: false, error: `El periodo ${periodo.codigo} aún no está liquidado.` }

  const tenant = await prismaMeta.tenant.findUnique({ where: { id: ctx.tenant.id }, select: { nit: true, nombre: true } })
  if (!tenant?.nit) return { ok: false, error: "El tenant no tiene NIT configurado — pídeselo al superadmin (Superadmin → Tenants)." }

  const liquidaciones = await ctx.db.liquidacionNomina.findMany({
    where: { periodoId },
    include: { usuario: true, detalles: { include: { concepto: true } } },
  })
  if (liquidaciones.length === 0) return { ok: false, error: "El periodo no tiene liquidaciones." }

  const sinDocumento = liquidaciones.filter((l) => !l.usuario.documento)
  if (sinDocumento.length > 0) {
    const nombres = sinDocumento.map((l) => `${l.usuario.nombre} ${l.usuario.apellido}`).join(", ")
    return { ok: false, error: `Falta el documento de identidad de: ${nombres}. RRHH debe capturarlo primero.` }
  }

  const empleados: EmpleadoPila[] = liquidaciones.map((l) => {
    const ibc = l.detalles.filter((d) => d.concepto.constitutivoSalario).reduce((s, d) => s + Number(d.valor), 0)
    return {
      tipoDocumento: l.usuario.tipoDocumento ?? "CC",
      documento: l.usuario.documento!,
      apellidos: l.usuario.apellido,
      nombres: l.usuario.nombre,
      ibc,
      diasCotizados: 30,
      codigoEps: l.usuario.codigoEps,
      codigoAfp: l.usuario.codigoAfp,
      codigoArl: l.usuario.codigoArl,
      claseRiesgoArl: l.usuario.claseRiesgoArl,
      codigoCaja: l.usuario.codigoCaja,
    }
  })

  const archivo = generarArchivoPila({ nit: tenant.nit, razonSocial: tenant.nombre, anio: periodo.anio, mes: periodo.mes }, empleados)

  try {
    await ctx.db.nominaPilaExport.create({
      data: { periodoId, totalEmpleados: empleados.length, generadoPor: ctx.sesion.usuarioId },
    })
    return { ok: true, mensaje: `PILA generada: ${empleados.length} afiliado(s).`, archivo, nombreArchivo: `PILA-${periodo.codigo}.txt` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al registrar la generación de la PILA." }
  }
}

/** Paga a un tercero externo (EPS/AFP/ARL/caja/DIAN) el pasivo que causó el pago de nómina. */
export async function pagarPasivoAction(_prev: NomState, formData: FormData): Promise<NomState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "pagar"))) {
    return { ok: false, error: "No tienes la capacidad para pagar pasivos de Nómina." }
  }
  const cuentaCodigo = String(formData.get("cuentaCodigo") ?? "").trim()
  const tercero = String(formData.get("tercero") ?? "").trim()
  const terceroNit = String(formData.get("terceroNit") ?? "").trim() || null
  const valor = Number(formData.get("valor"))
  const fecha = String(formData.get("fecha") ?? "").trim()
  const cuentaBancoId = String(formData.get("cuentaBancoId") ?? "").trim()
  const observacion = String(formData.get("observacion") ?? "").trim() || null

  if (!cuentaCodigo || !tercero || !fecha || !cuentaBancoId) return { ok: false, error: "Cuenta, tercero, fecha y cuenta de banco son obligatorios." }
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, error: "El valor debe ser mayor a 0." }

  const saldos = await saldosPasivosNomina(ctx.db)
  const saldo = saldos.find((s) => s.codigo === cuentaCodigo)
  if (!saldo) return { ok: false, error: "No hay saldo pendiente en esa cuenta." }
  if (valor > saldo.pendiente + 0.5) {
    return { ok: false, error: `Excede el saldo pendiente de ${saldo.nombre}: disponible $${saldo.pendiente.toLocaleString()}.` }
  }

  const [cuentaPasivo, cuentaBanco] = await Promise.all([
    ctx.db.planCuenta.findUnique({ where: { id: saldo.cuentaId } }),
    ctx.db.planCuenta.findUnique({ where: { id: cuentaBancoId } }),
  ])
  if (!cuentaPasivo || !cuentaBanco?.permiteMovimientos) return { ok: false, error: "Cuenta inválida." }

  const anio = new Date(fecha).getUTCFullYear()
  const periodoContable = await ctx.db.periodoContable.findFirst({ where: { estado: "ABIERTO" }, orderBy: [{ anio: "desc" }, { mes: "desc" }] })
  if (!periodoContable) return { ok: false, error: "No hay periodo contable ABIERTO para generar el comprobante." }

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
          numero, tipo: "EGRESO", fecha: new Date(fecha), descripcion: `Pago de pasivo de nómina a ${tercero}: ${cuentaPasivo.nombre}`,
          periodoId: periodoContable.id, anio, consecutivo: cons.ultimo, totalDebito: valor, totalCredito: valor,
          fuenteModulo: "nomina-pasivo", creadoPor: ctx.sesion.usuarioId,
          asientos: {
            create: [
              { cuentaId: saldo.cuentaId, debito: valor, credito: 0, descripcion: `Pago a ${tercero}` },
              { cuentaId: cuentaBancoId, debito: 0, credito: valor, descripcion: `Pago a ${tercero}` },
            ],
          },
        },
      })
      await tx.nominaPagoPasivo.create({
        data: {
          cuentaCodigo: saldo.codigo, cuentaNombre: cuentaPasivo.nombre, tercero, terceroNit, valor,
          fecha: new Date(fecha), comprobanteId: comprobante.id, observacion, creadoPor: ctx.sesion.usuarioId,
        },
      })
    })
    revalidatePath("/admin/nomina")
    revalidatePath("/admin/contabilidad")
    return { ok: true, mensaje: `Pago a ${tercero} registrado — $${valor.toLocaleString()}.` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al pagar el pasivo." }
  }
}

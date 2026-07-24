"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { liquidarPredial, liquidarIca } from "@/lib/rentas/motor"

// Acciones de RENTAS (impuesto predial + ICA). Gateadas por capacidad `rentas`
// (consultar/administrar/liquidar/recaudar). El contribuyente es SIEMPRE un `Tercero` existente
// (creado desde Contabilidad, mismo patrón ya usado por Contratación) — Rentas nunca duplica el
// registro de personas/NIT.

const MODULO = "rentas"
const DESTINOS = ["RESIDENCIAL", "COMERCIAL", "INDUSTRIAL", "RURAL", "LOTE_URBANIZABLE", "INSTITUCIONAL"]

export interface RentaState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function crearPredioAction(_prev: RentaState, formData: FormData): Promise<RentaState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Rentas." }

  const numeroPredial = String(formData.get("numeroPredial") ?? "").trim()
  const contribuyenteId = String(formData.get("contribuyenteId") ?? "").trim()
  const direccion = String(formData.get("direccion") ?? "").trim()
  const destino = String(formData.get("destino") ?? "").trim()
  const avaluoCatastral = Number(formData.get("avaluoCatastral"))
  const estrato = formData.get("estrato") ? Number(formData.get("estrato")) : null

  if (!numeroPredial || !contribuyenteId || !direccion) return { ok: false, error: "Número predial, contribuyente y dirección son obligatorios." }
  if (!DESTINOS.includes(destino)) return { ok: false, error: "Destino económico inválido." }
  if (!Number.isFinite(avaluoCatastral) || avaluoCatastral <= 0) return { ok: false, error: "El avalúo catastral debe ser mayor a 0." }

  try {
    await ctx.db.rentaPredio.create({ data: { numeroPredial, contribuyenteId, direccion, destino: destino as never, avaluoCatastral, estrato } })
    revalidatePath("/admin/rentas")
    return { ok: true, mensaje: `Predio ${numeroPredial} registrado.` }
  } catch {
    return { ok: false, error: "Error al registrar el predio (¿número predial repetido?)." }
  }
}

export async function crearActividadAction(_prev: RentaState, formData: FormData): Promise<RentaState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Rentas." }

  const codigo = String(formData.get("codigo") ?? "").trim()
  const nombre = String(formData.get("nombre") ?? "").trim()
  const tarifaXMil = Number(formData.get("tarifaXMil"))

  if (!codigo || !nombre) return { ok: false, error: "Código y nombre son obligatorios." }
  if (!Number.isFinite(tarifaXMil) || tarifaXMil <= 0) return { ok: false, error: "La tarifa por mil debe ser mayor a 0." }

  try {
    await ctx.db.rentaActividadEconomica.create({ data: { codigo, nombre, tarifaXMil } })
    revalidatePath("/admin/rentas")
    return { ok: true, mensaje: `Actividad "${nombre}" registrada.` }
  } catch {
    return { ok: false, error: "Error al registrar la actividad (¿código repetido?)." }
  }
}

export async function crearEstablecimientoAction(_prev: RentaState, formData: FormData): Promise<RentaState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Rentas." }

  const contribuyenteId = String(formData.get("contribuyenteId") ?? "").trim()
  const actividadId = String(formData.get("actividadId") ?? "").trim()
  const nombreComercial = String(formData.get("nombreComercial") ?? "").trim()
  const direccion = String(formData.get("direccion") ?? "").trim()

  if (!contribuyenteId || !actividadId || !nombreComercial || !direccion) return { ok: false, error: "Todos los campos son obligatorios." }

  try {
    await ctx.db.rentaEstablecimiento.create({ data: { contribuyenteId, actividadId, nombreComercial, direccion } })
    revalidatePath("/admin/rentas")
    return { ok: true, mensaje: `Establecimiento "${nombreComercial}" registrado.` }
  } catch {
    return { ok: false, error: "Error al registrar el establecimiento." }
  }
}

export async function crearTarifaPredialAction(_prev: RentaState, formData: FormData): Promise<RentaState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Rentas." }

  const vigencia = Number(formData.get("vigencia"))
  const destino = String(formData.get("destino") ?? "").trim()
  const avaluoDesde = Number(formData.get("avaluoDesde"))
  const avaluoHastaRaw = String(formData.get("avaluoHasta") ?? "").trim()
  const avaluoHasta = avaluoHastaRaw ? Number(avaluoHastaRaw) : null
  const tarifaXMil = Number(formData.get("tarifaXMil"))

  if (!Number.isFinite(vigencia)) return { ok: false, error: "Vigencia inválida." }
  if (!DESTINOS.includes(destino)) return { ok: false, error: "Destino económico inválido." }
  if (!Number.isFinite(avaluoDesde) || avaluoDesde < 0) return { ok: false, error: "El avalúo desde debe ser ≥ 0." }
  if (avaluoHasta !== null && avaluoHasta <= avaluoDesde) return { ok: false, error: "El avalúo hasta debe ser mayor que el avalúo desde." }
  if (!Number.isFinite(tarifaXMil) || tarifaXMil <= 0) return { ok: false, error: "La tarifa por mil debe ser mayor a 0." }

  try {
    await ctx.db.rentaTarifaPredial.create({ data: { vigencia, destino: destino as never, avaluoDesde, avaluoHasta, tarifaXMil } })
    revalidatePath("/admin/rentas")
    return { ok: true, mensaje: `Tarifa ${vigencia} para ${destino} registrada.` }
  } catch {
    return { ok: false, error: "Error al registrar la tarifa." }
  }
}

export async function liquidarPredialAction(_prev: RentaState, formData: FormData): Promise<RentaState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "liquidar"))) return { ok: false, error: "No tienes la capacidad para liquidar Rentas." }

  const predioId = String(formData.get("predioId") ?? "").trim()
  const vigencia = Number(formData.get("vigencia"))
  const fechaVencimiento = String(formData.get("fechaVencimiento") ?? "").trim()
  const rubroIngresoId = String(formData.get("rubroIngresoId") ?? "").trim() || null

  if (!predioId || !Number.isFinite(vigencia) || !fechaVencimiento) return { ok: false, error: "Predio, vigencia y fecha de vencimiento son obligatorios." }

  const predio = await ctx.db.rentaPredio.findUnique({ where: { id: predioId } })
  if (!predio) return { ok: false, error: "Predio no encontrado." }

  const yaExiste = await ctx.db.rentaLiquidacion.findFirst({ where: { predioId, vigencia, estado: { not: "ANULADA" } } })
  if (yaExiste) return { ok: false, error: `Ya existe una liquidación predial ${vigencia} para este predio (${yaExiste.numero}).` }

  const tarifas = await ctx.db.rentaTarifaPredial.findMany({ where: { vigencia } })
  const resultado = liquidarPredial(Number(predio.avaluoCatastral), predio.destino, tarifas.map((t) => ({ destino: t.destino, avaluoDesde: Number(t.avaluoDesde), avaluoHasta: t.avaluoHasta === null ? null : Number(t.avaluoHasta), tarifaXMil: Number(t.tarifaXMil) })))
  if (!resultado) return { ok: false, error: `No hay tarifa ${vigencia} registrada para destino ${predio.destino} y avalúo $${Number(predio.avaluoCatastral).toLocaleString()}.` }

  try {
    const liquidacion = await ctx.db.$transaction(async (tx) => {
      const cons = await tx.rentaLiquidacionConsecutivo.upsert({
        where: { tipo_vigencia: { tipo: "PREDIAL", vigencia } },
        create: { tipo: "PREDIAL", vigencia, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const numero = `PRE-${vigencia}-${String(cons.ultimo).padStart(6, "0")}`
      return tx.rentaLiquidacion.create({
        data: {
          numero, tipo: "PREDIAL", vigencia, predioId, rubroIngresoId,
          baseGravable: predio.avaluoCatastral, tarifaAplicada: resultado.tarifaAplicada, valor: resultado.valor,
          fechaVencimiento: new Date(fechaVencimiento), creadoPor: ctx.sesion.usuarioId,
        },
      })
    })
    revalidatePath("/admin/rentas")
    return { ok: true, mensaje: `${liquidacion.numero} liquidada — $${resultado.valor.toLocaleString()}.` }
  } catch {
    return { ok: false, error: "Error al liquidar el predial." }
  }
}

export async function liquidarIcaAction(_prev: RentaState, formData: FormData): Promise<RentaState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "liquidar"))) return { ok: false, error: "No tienes la capacidad para liquidar Rentas." }

  const establecimientoId = String(formData.get("establecimientoId") ?? "").trim()
  const vigencia = Number(formData.get("vigencia"))
  const ingresosBrutos = Number(formData.get("ingresosBrutos"))
  const fechaVencimiento = String(formData.get("fechaVencimiento") ?? "").trim()
  const rubroIngresoId = String(formData.get("rubroIngresoId") ?? "").trim() || null

  if (!establecimientoId || !Number.isFinite(vigencia) || !fechaVencimiento) return { ok: false, error: "Establecimiento, vigencia y fecha de vencimiento son obligatorios." }
  if (!Number.isFinite(ingresosBrutos) || ingresosBrutos < 0) return { ok: false, error: "Los ingresos brutos deben ser ≥ 0." }

  const establecimiento = await ctx.db.rentaEstablecimiento.findUnique({ where: { id: establecimientoId }, include: { actividad: true } })
  if (!establecimiento) return { ok: false, error: "Establecimiento no encontrado." }

  const yaExiste = await ctx.db.rentaLiquidacion.findFirst({ where: { establecimientoId, vigencia, estado: { not: "ANULADA" } } })
  if (yaExiste) return { ok: false, error: `Ya existe una liquidación ICA ${vigencia} para este establecimiento (${yaExiste.numero}).` }

  const resultado = liquidarIca(ingresosBrutos, Number(establecimiento.actividad.tarifaXMil))

  try {
    const liquidacion = await ctx.db.$transaction(async (tx) => {
      const cons = await tx.rentaLiquidacionConsecutivo.upsert({
        where: { tipo_vigencia: { tipo: "ICA", vigencia } },
        create: { tipo: "ICA", vigencia, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const numero = `ICA-${vigencia}-${String(cons.ultimo).padStart(6, "0")}`
      return tx.rentaLiquidacion.create({
        data: {
          numero, tipo: "ICA", vigencia, establecimientoId, rubroIngresoId,
          baseGravable: ingresosBrutos, tarifaAplicada: resultado.tarifaAplicada, valor: resultado.valor,
          fechaVencimiento: new Date(fechaVencimiento), creadoPor: ctx.sesion.usuarioId,
        },
      })
    })
    revalidatePath("/admin/rentas")
    return { ok: true, mensaje: `${liquidacion.numero} liquidada — $${resultado.valor.toLocaleString()}.` }
  } catch {
    return { ok: false, error: "Error al liquidar el ICA." }
  }
}

export async function pagarLiquidacionAction(_prev: RentaState, formData: FormData): Promise<RentaState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "recaudar"))) return { ok: false, error: "No tienes la capacidad para recaudar Rentas." }

  const liquidacionId = String(formData.get("liquidacionId") ?? "").trim()
  const cuentaBancoId = String(formData.get("cuentaBancoId") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()
  const medioPago = String(formData.get("medioPago") ?? "TRANSFERENCIA").trim()

  if (!liquidacionId || !cuentaBancoId || !fecha) return { ok: false, error: "Liquidación, cuenta de banco y fecha son obligatorios." }

  const liquidacion = await ctx.db.rentaLiquidacion.findUnique({ where: { id: liquidacionId } })
  if (!liquidacion) return { ok: false, error: "Liquidación no encontrada." }
  if (liquidacion.estado !== "PENDIENTE") return { ok: false, error: `Esta liquidación ya está ${liquidacion.estado}.` }

  const cuentaIngresoCodigo = liquidacion.tipo === "PREDIAL" ? "410502" : "410510"
  const [cuentaBanco, cuentaIngreso] = await Promise.all([
    ctx.db.planCuenta.findUnique({ where: { id: cuentaBancoId } }),
    ctx.db.planCuenta.findUnique({ where: { codigo: cuentaIngresoCodigo } }),
  ])
  if (!cuentaBanco?.permiteMovimientos) return { ok: false, error: "Cuenta de banco inválida." }
  if (!cuentaIngreso) return { ok: false, error: `Cuenta contable ${cuentaIngresoCodigo} no encontrada en el plan de cuentas.` }

  const valor = Number(liquidacion.valor)
  const anio = new Date(fecha).getUTCFullYear()
  const periodoContable = await ctx.db.periodoContable.findFirst({ where: { estado: "ABIERTO" }, orderBy: [{ anio: "desc" }, { mes: "desc" }] })
  if (!periodoContable) return { ok: false, error: "No hay periodo contable ABIERTO para generar el comprobante." }

  try {
    await ctx.db.$transaction(async (tx) => {
      const vigente = await tx.rentaLiquidacion.findUnique({ where: { id: liquidacionId } })
      if (vigente?.estado !== "PENDIENTE") throw new Error("La liquidación ya no está pendiente.")

      const cons = await tx.comprobanteConsecutivo.upsert({
        where: { tipo_anio: { tipo: "INGRESO", anio } },
        create: { tipo: "INGRESO", anio, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const numeroComprobante = `CI-${anio}-${String(cons.ultimo).padStart(6, "0")}`
      const descripcion = `Recaudo ${liquidacion.tipo === "PREDIAL" ? "predial" : "ICA"} ${liquidacion.numero}`

      const comprobante = await tx.comprobante.create({
        data: {
          numero: numeroComprobante, tipo: "INGRESO", fecha: new Date(fecha), descripcion,
          periodoId: periodoContable.id, anio, consecutivo: cons.ultimo, totalDebito: valor, totalCredito: valor,
          fuenteModulo: "rentas", fuenteRef: liquidacion.id, creadoPor: ctx.sesion.usuarioId,
          asientos: {
            create: [
              { cuentaId: cuentaBanco.id, debito: valor, credito: 0, descripcion },
              { cuentaId: cuentaIngreso.id, debito: 0, credito: valor, descripcion },
            ],
          },
        },
      })

      await tx.rentaPago.create({
        data: {
          numero: `REC-${liquidacion.numero}`, liquidacionId, valor, fecha: new Date(fecha),
          medioPago: medioPago as never, comprobanteId: comprobante.id, creadoPor: ctx.sesion.usuarioId,
        },
      })
      await tx.rentaLiquidacion.update({ where: { id: liquidacionId }, data: { estado: "PAGADA" } })
    })
    revalidatePath("/admin/rentas")
    revalidatePath("/admin/contabilidad")
    revalidatePath("/admin/tesoreria")
    return { ok: true, mensaje: `${liquidacion.numero} pagada — $${valor.toLocaleString()}.` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al registrar el pago." }
  }
}

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

export async function crearRpAction(_prev: PspState, formData: FormData): Promise<PspState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "expedir_rp"))) {
    return { ok: false, error: "No tienes la capacidad para expedir RP." }
  }
  const cdpId = String(formData.get("cdpId") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()
  const objeto = String(formData.get("objeto") ?? "").trim()
  const terceroId = String(formData.get("terceroId") ?? "").trim() || null
  const valor = Number(formData.get("valor"))

  if (!cdpId) return { ok: false, error: "Selecciona un CDP." }
  if (!fecha || !objeto) return { ok: false, error: "Fecha y objeto son obligatorios." }
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, error: "El valor debe ser mayor a 0." }

  const cdp = await ctx.db.cdp.findUnique({ where: { id: cdpId } })
  if (!cdp) return { ok: false, error: "CDP no encontrado." }
  if (cdp.estado === "ANULADO") return { ok: false, error: `El ${cdp.numero} está anulado.` }

  const rpsVigentes = await ctx.db.rp.findMany({ where: { cdpId, estado: "VIGENTE" }, select: { valor: true } })
  const comprometido = rpsVigentes.reduce((s, r) => s + Number(r.valor), 0)
  const disponible = Number(cdp.valor) - comprometido

  if (valor > disponible + 0.5) {
    return { ok: false, error: `No hay saldo suficiente en el ${cdp.numero}: disponible $${disponible.toLocaleString()}, solicitado $${valor.toLocaleString()}.` }
  }

  try {
    const rp = await ctx.db.$transaction(async (tx) => {
      const cons = await tx.rpConsecutivo.upsert({
        where: { vigencia: cdp.vigencia },
        create: { vigencia: cdp.vigencia, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const numero = `RP-${cdp.vigencia}-${String(cons.ultimo).padStart(6, "0")}`
      return tx.rp.create({
        data: { numero, fecha: new Date(fecha), vigencia: cdp.vigencia, cdpId, terceroId, valor, objeto, creadoPor: ctx.sesion.usuarioId },
      })
    })
    revalidatePath("/admin/presupuesto")
    return { ok: true, mensaje: `${rp.numero} expedido · $${valor.toLocaleString()} sobre ${cdp.numero}.` }
  } catch {
    return { ok: false, error: "Error al expedir el RP." }
  }
}

export async function crearObligacionAction(_prev: PspState, formData: FormData): Promise<PspState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "expedir_rp"))) {
    return { ok: false, error: "No tienes la capacidad para expedir obligaciones." }
  }
  const rpId = String(formData.get("rpId") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()
  const concepto = String(formData.get("concepto") ?? "").trim()
  const valor = Number(formData.get("valor"))

  if (!rpId) return { ok: false, error: "Selecciona un RP." }
  if (!fecha || !concepto) return { ok: false, error: "Fecha y concepto son obligatorios." }
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, error: "El valor debe ser mayor a 0." }

  const rp = await ctx.db.rp.findUnique({ where: { id: rpId } })
  if (!rp) return { ok: false, error: "RP no encontrado." }
  if (rp.estado === "ANULADO") return { ok: false, error: `El ${rp.numero} está anulado.` }

  const obligacionesVigentes = await ctx.db.obligacion.findMany({ where: { rpId, estado: "VIGENTE" }, select: { valor: true } })
  const obligado = obligacionesVigentes.reduce((s, o) => s + Number(o.valor), 0)
  const disponible = Number(rp.valor) - obligado

  if (valor > disponible + 0.5) {
    return { ok: false, error: `No hay saldo suficiente en el ${rp.numero}: disponible $${disponible.toLocaleString()}, solicitado $${valor.toLocaleString()}.` }
  }

  try {
    const obligacion = await ctx.db.$transaction(async (tx) => {
      const cons = await tx.obligacionConsecutivo.upsert({
        where: { vigencia: rp.vigencia },
        create: { vigencia: rp.vigencia, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const numero = `OB-${rp.vigencia}-${String(cons.ultimo).padStart(6, "0")}`
      return tx.obligacion.create({
        data: { numero, fecha: new Date(fecha), rpId, valor, concepto, creadoPor: ctx.sesion.usuarioId },
      })
    })
    revalidatePath("/admin/presupuesto")
    return { ok: true, mensaje: `${obligacion.numero} registrada · $${valor.toLocaleString()} sobre ${rp.numero}.` }
  } catch {
    return { ok: false, error: "Error al registrar la obligación." }
  }
}

const MEDIOS_PAGO = ["TRANSFERENCIA", "CHEQUE", "EFECTIVO", "OTRO"]

export async function registrarPagoAction(_prev: PspState, formData: FormData): Promise<PspState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "expedir_rp"))) {
    return { ok: false, error: "No tienes la capacidad para registrar pagos." }
  }
  const obligacionId = String(formData.get("obligacionId") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()
  const medioPago = String(formData.get("medioPago") ?? "TRANSFERENCIA").trim()
  const referencia = String(formData.get("referencia") ?? "").trim() || null
  const cuentaGastoId = String(formData.get("cuentaGastoId") ?? "").trim()
  const cuentaBancoId = String(formData.get("cuentaBancoId") ?? "").trim()
  const valor = Number(formData.get("valor"))

  if (!obligacionId) return { ok: false, error: "Selecciona una obligación." }
  if (!fecha) return { ok: false, error: "La fecha es obligatoria." }
  if (!MEDIOS_PAGO.includes(medioPago)) return { ok: false, error: "Medio de pago inválido." }
  if (!cuentaGastoId || !cuentaBancoId) return { ok: false, error: "Selecciona la cuenta de gasto y la cuenta de banco." }
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, error: "El valor debe ser mayor a 0." }

  const obligacion = await ctx.db.obligacion.findUnique({ where: { id: obligacionId } })
  if (!obligacion) return { ok: false, error: "Obligación no encontrada." }
  if (obligacion.estado === "ANULADO") return { ok: false, error: `La ${obligacion.numero} está anulada.` }

  const pagosVigentes = await ctx.db.pago.findMany({ where: { obligacionId, estado: "VIGENTE" }, select: { valor: true } })
  const pagado = pagosVigentes.reduce((s, p) => s + Number(p.valor), 0)
  const disponible = Number(obligacion.valor) - pagado

  if (valor > disponible + 0.5) {
    return { ok: false, error: `No hay saldo suficiente en la ${obligacion.numero}: disponible $${disponible.toLocaleString()}, solicitado $${valor.toLocaleString()}.` }
  }

  const [cuentaGasto, cuentaBanco] = await Promise.all([
    ctx.db.planCuenta.findUnique({ where: { id: cuentaGastoId } }),
    ctx.db.planCuenta.findUnique({ where: { id: cuentaBancoId } }),
  ])
  if (!cuentaGasto?.permiteMovimientos) return { ok: false, error: "Cuenta de gasto inválida." }
  if (!cuentaBanco?.permiteMovimientos) return { ok: false, error: "Cuenta de banco inválida." }

  const anio = new Date(fecha).getUTCFullYear()
  const periodo = await ctx.db.periodoContable.findFirst({ where: { estado: "ABIERTO" }, orderBy: [{ anio: "desc" }, { mes: "desc" }] })
  if (!periodo) return { ok: false, error: "No hay periodo contable ABIERTO para generar el comprobante." }

  try {
    const pago = await ctx.db.$transaction(async (tx) => {
      const consComp = await tx.comprobanteConsecutivo.upsert({
        where: { tipo_anio: { tipo: "EGRESO", anio } },
        create: { tipo: "EGRESO", anio, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const numeroComp = `CE-${anio}-${String(consComp.ultimo).padStart(6, "0")}`
      const comprobante = await tx.comprobante.create({
        data: {
          numero: numeroComp, tipo: "EGRESO", fecha: new Date(fecha), descripcion: `Pago ${obligacion.numero}: ${obligacion.concepto}`,
          periodoId: periodo.id, anio, consecutivo: consComp.ultimo, totalDebito: valor, totalCredito: valor,
          fuenteModulo: "presupuesto", creadoPor: ctx.sesion.usuarioId,
          asientos: {
            create: [
              { cuentaId: cuentaGastoId, debito: valor, credito: 0, descripcion: "Gasto ejecutado" },
              { cuentaId: cuentaBancoId, debito: 0, credito: valor, descripcion: `Pago vía ${medioPago}` },
            ],
          },
        },
      })

      const cons = await tx.pagoConsecutivo.upsert({
        where: { vigencia: anio },
        create: { vigencia: anio, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const numero = `PG-${anio}-${String(cons.ultimo).padStart(6, "0")}`
      const creado = await tx.pago.create({
        data: {
          numero, fecha: new Date(fecha), obligacionId, valor, medioPago: medioPago as never, referencia,
          comprobanteId: comprobante.id, creadoPor: ctx.sesion.usuarioId,
        },
      })
      await tx.comprobante.update({ where: { id: comprobante.id }, data: { fuenteRef: creado.id } })
      return creado
    })
    revalidatePath("/admin/presupuesto")
    revalidatePath("/admin/contabilidad")
    return { ok: true, mensaje: `${pago.numero} registrado · $${valor.toLocaleString()} · comprobante contable generado.` }
  } catch {
    return { ok: false, error: "Error al registrar el pago." }
  }
}

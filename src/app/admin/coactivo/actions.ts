"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { calcularCuotas } from "@/lib/coactivo/motor"

// Acciones de COBRO COACTIVO. Gateadas por capacidad `cobro_coactivo` (consultar/gestionar/
// recaudar) — separación real: quien gestiona el proceso (mandamiento, embargo, acuerdo) no es
// necesariamente quien recibe el pago (recaudar), mismo criterio que Rentas.

const MODULO = "cobro_coactivo"
const TIPOS_ACTUACION_MANUAL = ["COBRO_PERSUASIVO", "MANDAMIENTO_PAGO", "MEDIDA_CAUTELAR", "TERMINACION", "OTRA"]

export interface CoactivoState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function abrirProcesoAction(_prev: CoactivoState, formData: FormData): Promise<CoactivoState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "gestionar"))) return { ok: false, error: "No tienes la capacidad para gestionar Cobro Coactivo." }

  const contribuyenteId = String(formData.get("contribuyenteId") ?? "").trim()
  const tipo = String(formData.get("tipo") ?? "").trim()
  const vigencia = Number(formData.get("vigencia"))
  const fecha = String(formData.get("fecha") ?? "").trim()

  if (!contribuyenteId || !fecha) return { ok: false, error: "Contribuyente y fecha son obligatorios." }
  if (tipo !== "PREDIAL" && tipo !== "ICA") return { ok: false, error: "Tipo de impuesto inválido." }
  if (!Number.isFinite(vigencia)) return { ok: false, error: "Vigencia inválida." }

  const hoy = new Date()
  const liquidaciones = await ctx.db.rentaLiquidacion.findMany({
    where: {
      tipo: tipo as never,
      estado: "PENDIENTE",
      fechaVencimiento: { lt: hoy },
      procesoCoactivoId: null,
      ...(tipo === "PREDIAL" ? { predio: { contribuyenteId } } : { establecimiento: { contribuyenteId } }),
    },
  })
  if (liquidaciones.length === 0) return { ok: false, error: "Este contribuyente no tiene cartera vencida de ese impuesto para abrir un proceso." }

  const valorInicial = liquidaciones.reduce((s, l) => s + Number(l.valor), 0)

  try {
    const proceso = await ctx.db.$transaction(async (tx) => {
      const cons = await tx.coactivoConsecutivo.upsert({
        where: { vigencia },
        create: { vigencia, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      })
      const numero = `COA-${vigencia}-${String(cons.ultimo).padStart(6, "0")}`
      const p = await tx.coactivoProceso.create({
        data: {
          numero, vigencia, contribuyenteId, tipo: tipo as never, valorInicial,
          fechaApertura: new Date(fecha), creadoPor: ctx.sesion.usuarioId,
        },
      })
      await tx.rentaLiquidacion.updateMany({
        where: { id: { in: liquidaciones.map((l) => l.id) } },
        data: { procesoCoactivoId: p.id, estado: "EN_COBRO_COACTIVO" },
      })
      await tx.coactivoActuacion.create({
        data: {
          procesoId: p.id, tipo: "COBRO_PERSUASIVO", fecha: new Date(fecha),
          descripcion: `Apertura del proceso — ${liquidaciones.length} liquidación(es) vencida(s), deuda inicial $${valorInicial.toLocaleString()}.`,
          registradoPor: ctx.sesion.usuarioId,
        },
      })
      return p
    })
    revalidatePath("/admin/coactivo")
    revalidatePath("/admin/rentas")
    return { ok: true, mensaje: `${proceso.numero} abierto — deuda inicial $${valorInicial.toLocaleString()}.` }
  } catch {
    return { ok: false, error: "Error al abrir el proceso." }
  }
}

export async function registrarActuacionAction(_prev: CoactivoState, formData: FormData): Promise<CoactivoState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "gestionar"))) return { ok: false, error: "No tienes la capacidad para gestionar Cobro Coactivo." }

  const procesoId = String(formData.get("procesoId") ?? "").trim()
  const tipo = String(formData.get("tipo") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()
  const descripcion = String(formData.get("descripcion") ?? "").trim()

  if (!procesoId || !fecha || !descripcion) return { ok: false, error: "Proceso, fecha y descripción son obligatorios." }
  if (!TIPOS_ACTUACION_MANUAL.includes(tipo)) return { ok: false, error: "Tipo de actuación inválido." }

  const proceso = await ctx.db.coactivoProceso.findUnique({ where: { id: procesoId } })
  if (!proceso) return { ok: false, error: "Proceso no encontrado." }
  if (proceso.estado === "TERMINADO") return { ok: false, error: "Este proceso ya está TERMINADO." }

  try {
    await ctx.db.$transaction(async (tx) => {
      await tx.coactivoActuacion.create({
        data: { procesoId, tipo: tipo as never, fecha: new Date(fecha), descripcion, registradoPor: ctx.sesion.usuarioId },
      })
      if (tipo === "MANDAMIENTO_PAGO") {
        await tx.coactivoProceso.update({ where: { id: procesoId }, data: { estado: "MANDAMIENTO_PAGO" } })
      } else if (tipo === "MEDIDA_CAUTELAR") {
        await tx.coactivoProceso.update({ where: { id: procesoId }, data: { estado: "EMBARGO" } })
      } else if (tipo === "TERMINACION") {
        // Terminación SIN pago (prescripción, remisión, insolvencia) — la deuda se anula, no se paga.
        await tx.coactivoProceso.update({ where: { id: procesoId }, data: { estado: "TERMINADO" } })
        await tx.rentaLiquidacion.updateMany({ where: { procesoCoactivoId: procesoId, estado: "EN_COBRO_COACTIVO" }, data: { estado: "ANULADA" } })
      }
    })
    revalidatePath("/admin/coactivo")
    revalidatePath("/admin/rentas")
    return { ok: true, mensaje: "Actuación registrada." }
  } catch {
    return { ok: false, error: "Error al registrar la actuación." }
  }
}

export async function crearAcuerdoPagoAction(_prev: CoactivoState, formData: FormData): Promise<CoactivoState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "gestionar"))) return { ok: false, error: "No tienes la capacidad para gestionar Cobro Coactivo." }

  const procesoId = String(formData.get("procesoId") ?? "").trim()
  const numeroCuotas = Number(formData.get("numeroCuotas"))
  const fechaPrimeraCuota = String(formData.get("fechaPrimeraCuota") ?? "").trim()

  if (!procesoId || !fechaPrimeraCuota) return { ok: false, error: "Proceso y fecha de la primera cuota son obligatorios." }
  if (!Number.isInteger(numeroCuotas) || numeroCuotas < 1 || numeroCuotas > 36) return { ok: false, error: "El número de cuotas debe ser entre 1 y 36." }

  const proceso = await ctx.db.coactivoProceso.findUnique({ where: { id: procesoId }, include: { acuerdoPago: true } })
  if (!proceso) return { ok: false, error: "Proceso no encontrado." }
  if (proceso.estado === "TERMINADO") return { ok: false, error: "Este proceso ya está TERMINADO." }
  if (proceso.acuerdoPago) return { ok: false, error: "Este proceso ya tiene un acuerdo de pago." }

  const cuotas = calcularCuotas(Number(proceso.valorInicial), numeroCuotas, new Date(fechaPrimeraCuota))

  try {
    await ctx.db.$transaction(async (tx) => {
      await tx.coactivoAcuerdoPago.create({
        data: {
          procesoId, numeroCuotas, valorCuota: cuotas[0].valor, fechaPrimeraCuota: new Date(fechaPrimeraCuota),
          cuotas: { create: cuotas.map((c) => ({ numero: c.numero, fechaVencimiento: c.fechaVencimiento, valor: c.valor })) },
        },
      })
      await tx.coactivoProceso.update({ where: { id: procesoId }, data: { estado: "ACUERDO_PAGO" } })
      await tx.coactivoActuacion.create({
        data: {
          procesoId, tipo: "ACUERDO_PAGO", fecha: new Date(fechaPrimeraCuota),
          descripcion: `Acuerdo de pago en ${numeroCuotas} cuota(s), primera cuota $${cuotas[0].valor.toLocaleString()}.`,
          registradoPor: ctx.sesion.usuarioId,
        },
      })
    })
    revalidatePath("/admin/coactivo")
    return { ok: true, mensaje: `Acuerdo de pago creado — ${numeroCuotas} cuota(s).` }
  } catch {
    return { ok: false, error: "Error al crear el acuerdo de pago." }
  }
}

async function postearComprobanteCoactivo(
  tx: Parameters<Parameters<Awaited<ReturnType<typeof requerirFuncionario>>["db"]["$transaction"]>[0]>[0],
  args: { tipo: "PREDIAL" | "ICA"; valor: number; fecha: Date; descripcion: string; cuentaBancoId: string; usuarioId: string; fuenteRef: string },
) {
  const cuentaIngresoCodigo = args.tipo === "PREDIAL" ? "410502" : "410510"
  const [cuentaBanco, cuentaIngreso, periodoContable] = await Promise.all([
    tx.planCuenta.findUnique({ where: { id: args.cuentaBancoId } }),
    tx.planCuenta.findUnique({ where: { codigo: cuentaIngresoCodigo } }),
    tx.periodoContable.findFirst({ where: { estado: "ABIERTO" }, orderBy: [{ anio: "desc" }, { mes: "desc" }] }),
  ])
  if (!cuentaBanco?.permiteMovimientos) throw new Error("Cuenta de banco inválida.")
  if (!cuentaIngreso) throw new Error(`Cuenta contable ${cuentaIngresoCodigo} no encontrada.`)
  if (!periodoContable) throw new Error("No hay periodo contable ABIERTO para generar el comprobante.")

  const anio = args.fecha.getUTCFullYear()
  const cons = await tx.comprobanteConsecutivo.upsert({
    where: { tipo_anio: { tipo: "INGRESO", anio } },
    create: { tipo: "INGRESO", anio, ultimo: 1 },
    update: { ultimo: { increment: 1 } },
  })
  const numero = `CI-${anio}-${String(cons.ultimo).padStart(6, "0")}`
  return tx.comprobante.create({
    data: {
      numero, tipo: "INGRESO", fecha: args.fecha, descripcion: args.descripcion,
      periodoId: periodoContable.id, anio, consecutivo: cons.ultimo, totalDebito: args.valor, totalCredito: args.valor,
      fuenteModulo: "cobro_coactivo", fuenteRef: args.fuenteRef, creadoPor: args.usuarioId,
      asientos: {
        create: [
          { cuentaId: cuentaBanco.id, debito: args.valor, credito: 0, descripcion: args.descripcion },
          { cuentaId: cuentaIngreso.id, debito: 0, credito: args.valor, descripcion: args.descripcion },
        ],
      },
    },
  })
}

export async function pagarCuotaAction(_prev: CoactivoState, formData: FormData): Promise<CoactivoState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "recaudar"))) return { ok: false, error: "No tienes la capacidad para recaudar Cobro Coactivo." }

  const cuotaId = String(formData.get("cuotaId") ?? "").trim()
  const cuentaBancoId = String(formData.get("cuentaBancoId") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()

  if (!cuotaId || !cuentaBancoId || !fecha) return { ok: false, error: "Cuota, cuenta de banco y fecha son obligatorios." }

  const cuota = await ctx.db.coactivoCuota.findUnique({ where: { id: cuotaId }, include: { acuerdo: { include: { proceso: true, cuotas: true } } } })
  if (!cuota) return { ok: false, error: "Cuota no encontrada." }
  if (cuota.estado !== "PENDIENTE") return { ok: false, error: "Esta cuota ya está pagada." }

  const proceso = cuota.acuerdo.proceso
  const valor = Number(cuota.valor)

  try {
    await ctx.db.$transaction(async (tx) => {
      const comprobante = await postearComprobanteCoactivo(tx, {
        tipo: proceso.tipo as "PREDIAL" | "ICA", valor, fecha: new Date(fecha),
        descripcion: `Cuota ${cuota.numero}/${cuota.acuerdo.numeroCuotas} — ${proceso.numero}`,
        cuentaBancoId, usuarioId: ctx.sesion.usuarioId, fuenteRef: proceso.id,
      })
      await tx.coactivoCuota.update({ where: { id: cuotaId }, data: { estado: "PAGADA", comprobanteId: comprobante.id, creadoPor: ctx.sesion.usuarioId } })
      await tx.coactivoActuacion.create({
        data: {
          procesoId: proceso.id, tipo: "PAGO", fecha: new Date(fecha),
          descripcion: `Pago de la cuota ${cuota.numero}/${cuota.acuerdo.numeroCuotas}: $${valor.toLocaleString()}.`,
          registradoPor: ctx.sesion.usuarioId,
        },
      })
      const pendientes = cuota.acuerdo.cuotas.filter((c) => c.id !== cuotaId && c.estado === "PENDIENTE")
      if (pendientes.length === 0) {
        await tx.coactivoProceso.update({ where: { id: proceso.id }, data: { estado: "TERMINADO" } })
        await tx.rentaLiquidacion.updateMany({ where: { procesoCoactivoId: proceso.id }, data: { estado: "PAGADA" } })
        await tx.coactivoActuacion.create({
          data: { procesoId: proceso.id, tipo: "TERMINACION", fecha: new Date(fecha), descripcion: "Proceso terminado: acuerdo de pago cumplido en su totalidad.", registradoPor: ctx.sesion.usuarioId },
        })
      }
    })
    revalidatePath("/admin/coactivo")
    revalidatePath("/admin/rentas")
    revalidatePath("/admin/contabilidad")
    revalidatePath("/admin/tesoreria")
    return { ok: true, mensaje: `Cuota ${cuota.numero} pagada — $${valor.toLocaleString()}.` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al pagar la cuota." }
  }
}

export async function pagarTotalAction(_prev: CoactivoState, formData: FormData): Promise<CoactivoState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "recaudar"))) return { ok: false, error: "No tienes la capacidad para recaudar Cobro Coactivo." }

  const procesoId = String(formData.get("procesoId") ?? "").trim()
  const cuentaBancoId = String(formData.get("cuentaBancoId") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()

  if (!procesoId || !cuentaBancoId || !fecha) return { ok: false, error: "Proceso, cuenta de banco y fecha son obligatorios." }

  const proceso = await ctx.db.coactivoProceso.findUnique({ where: { id: procesoId }, include: { acuerdoPago: true } })
  if (!proceso) return { ok: false, error: "Proceso no encontrado." }
  if (proceso.estado === "TERMINADO") return { ok: false, error: "Este proceso ya está TERMINADO." }
  if (proceso.acuerdoPago) return { ok: false, error: "Este proceso ya tiene un acuerdo de pago — paga las cuotas restantes en su lugar." }

  const valor = Number(proceso.valorInicial)

  try {
    await ctx.db.$transaction(async (tx) => {
      await postearComprobanteCoactivo(tx, {
        tipo: proceso.tipo as "PREDIAL" | "ICA", valor, fecha: new Date(fecha),
        descripcion: `Pago total — ${proceso.numero}`, cuentaBancoId, usuarioId: ctx.sesion.usuarioId, fuenteRef: proceso.id,
      })
      await tx.coactivoProceso.update({ where: { id: procesoId }, data: { estado: "TERMINADO" } })
      await tx.rentaLiquidacion.updateMany({ where: { procesoCoactivoId: procesoId }, data: { estado: "PAGADA" } })
      await tx.coactivoActuacion.create({
        data: { procesoId, tipo: "PAGO", fecha: new Date(fecha), descripcion: `Pago total de la deuda: $${valor.toLocaleString()}.`, registradoPor: ctx.sesion.usuarioId },
      })
      await tx.coactivoActuacion.create({
        data: { procesoId, tipo: "TERMINACION", fecha: new Date(fecha), descripcion: "Proceso terminado: pago total recibido.", registradoPor: ctx.sesion.usuarioId },
      })
    })
    revalidatePath("/admin/coactivo")
    revalidatePath("/admin/rentas")
    revalidatePath("/admin/contabilidad")
    revalidatePath("/admin/tesoreria")
    return { ok: true, mensaje: `${proceso.numero} pagado en su totalidad — $${valor.toLocaleString()}.` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al registrar el pago." }
  }
}

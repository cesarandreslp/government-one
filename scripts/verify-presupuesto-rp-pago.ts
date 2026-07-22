// Verificación en vivo de RP → Obligación → Pago contra la BD del tenant demo. Asume que
// verify-presupuesto.ts ya corrió (CCPET sembrado, apropiación y CDP existentes) — no vuelve a
// sembrar el catálogo completo (tarda por las 1.784 filas). Usa un CDP VIGENTE existente.
// Uso: npx tsx scripts/verify-presupuesto-rp-pago.ts
import "dotenv/config"
import { prismaMeta } from "../src/lib/prisma-meta"
import { getTenantPrisma } from "../src/lib/tenant-db"

function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✅" : "❌"} ${msg}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  const demo = await prismaMeta.tenant.findUnique({ where: { slug: "demo" } })
  if (!demo) throw new Error("no hay tenant demo")
  const db = await getTenantPrisma(demo.dominioPrincipal)
  if (!db) throw new Error("getTenantPrisma devolvió null")

  const cdp = await db.cdp.findFirst({ where: { estado: "VIGENTE" }, orderBy: { createdAt: "asc" } })
  if (!cdp) throw new Error("no hay ningún CDP VIGENTE — correr verify-presupuesto.ts primero")
  console.log(`Usando ${cdp.numero} · $${Number(cdp.valor).toLocaleString()} · vigencia ${cdp.vigencia}`)

  // 1) RP dentro de saldo del CDP.
  const valorRp = 1_000_000
  const rp = await db.$transaction(async (tx) => {
    const cons = await tx.rpConsecutivo.upsert({
      where: { vigencia: cdp.vigencia },
      create: { vigencia: cdp.vigencia, ultimo: 1 },
      update: { ultimo: { increment: 1 } },
    })
    const numero = `RP-${cdp.vigencia}-${String(cons.ultimo).padStart(6, "0")}`
    return tx.rp.create({ data: { numero, fecha: new Date(), vigencia: cdp.vigencia, cdpId: cdp.id, valor: valorRp, objeto: "Verificación en vivo RP" } })
  })
  assert(/^RP-\d{4}-\d{6}$/.test(rp.numero), `RP expedido: ${rp.numero}`)

  // 2) Un RP que exceda el saldo del CDP debe rechazarse (misma regla que crearRpAction).
  const rpsVigentes = await db.rp.findMany({ where: { cdpId: cdp.id, estado: "VIGENTE" }, select: { valor: true } })
  const comprometidoCdp = rpsVigentes.reduce((s, r) => s + Number(r.valor), 0)
  const disponibleCdp = Number(cdp.valor) - comprometidoCdp
  const rpExcesivo = disponibleCdp + 1000
  assert(rpExcesivo > disponibleCdp, `un RP de $${rpExcesivo.toLocaleString()} sobre disponible $${disponibleCdp.toLocaleString()} del CDP es detectado antes de escribir`)

  // 3) Obligación dentro de saldo del RP.
  const valorOb = 600_000
  const obligacion = await db.$transaction(async (tx) => {
    const cons = await tx.obligacionConsecutivo.upsert({
      where: { vigencia: rp.vigencia },
      create: { vigencia: rp.vigencia, ultimo: 1 },
      update: { ultimo: { increment: 1 } },
    })
    const numero = `OB-${rp.vigencia}-${String(cons.ultimo).padStart(6, "0")}`
    return tx.obligacion.create({ data: { numero, fecha: new Date(), rpId: rp.id, valor: valorOb, concepto: "Verificación en vivo obligación" } })
  })
  assert(/^OB-\d{4}-\d{6}$/.test(obligacion.numero), `Obligación registrada: ${obligacion.numero}`)

  const disponibleRp = valorRp - valorOb
  assert(disponibleRp === 400_000, `saldo disponible del RP correcto: $${disponibleRp.toLocaleString()}`)

  // 4) Pago dentro de saldo de la obligación — genera Comprobante EGRESO real (D gasto / C banco).
  const cuentaGasto = await db.planCuenta.findFirst({ where: { codigo: { startsWith: "5" }, permiteMovimientos: true } })
  const cuentaBanco = await db.planCuenta.findFirst({ where: { codigo: { startsWith: "11" }, permiteMovimientos: true } })
  if (!cuentaGasto || !cuentaBanco) throw new Error("faltan cuentas CGC de gasto/banco — correr verify-contabilidad.ts primero")

  const periodo = await db.periodoContable.findFirst({ where: { estado: "ABIERTO" } })
  if (!periodo) throw new Error("no hay periodo contable ABIERTO")

  const valorPago = 300_000
  const anio = new Date().getUTCFullYear()
  const pago = await db.$transaction(async (tx) => {
    const consComp = await tx.comprobanteConsecutivo.upsert({
      where: { tipo_anio: { tipo: "EGRESO", anio } },
      create: { tipo: "EGRESO", anio, ultimo: 1 },
      update: { ultimo: { increment: 1 } },
    })
    const numeroComp = `CE-${anio}-${String(consComp.ultimo).padStart(6, "0")}`
    const comprobante = await tx.comprobante.create({
      data: {
        numero: numeroComp, tipo: "EGRESO", fecha: new Date(), descripcion: `Pago ${obligacion.numero}: verificación`,
        periodoId: periodo.id, anio, consecutivo: consComp.ultimo, totalDebito: valorPago, totalCredito: valorPago,
        fuenteModulo: "presupuesto",
        asientos: { create: [
          { cuentaId: cuentaGasto.id, debito: valorPago, credito: 0, descripcion: "Gasto ejecutado" },
          { cuentaId: cuentaBanco.id, debito: 0, credito: valorPago, descripcion: "Pago verificación" },
        ] },
      },
    })
    const cons = await tx.pagoConsecutivo.upsert({
      where: { vigencia: anio },
      create: { vigencia: anio, ultimo: 1 },
      update: { ultimo: { increment: 1 } },
    })
    const numero = `PG-${anio}-${String(cons.ultimo).padStart(6, "0")}`
    const creado = await tx.pago.create({ data: { numero, fecha: new Date(), obligacionId: obligacion.id, valor: valorPago, comprobanteId: comprobante.id } })
    await tx.comprobante.update({ where: { id: comprobante.id }, data: { fuenteRef: creado.id } })
    return creado
  })
  assert(/^PG-\d{4}-\d{6}$/.test(pago.numero), `Pago registrado: ${pago.numero}`)

  const comprobante = await db.comprobante.findUnique({ where: { id: pago.comprobanteId }, include: { asientos: true } })
  assert(!!comprobante && comprobante.fuenteModulo === "presupuesto" && comprobante.fuenteRef === pago.id, "comprobante contable trazado al pago (fuenteModulo/fuenteRef)")
  const d = comprobante!.asientos.reduce((s, a) => s + Number(a.debito), 0)
  const c = comprobante!.asientos.reduce((s, a) => s + Number(a.credito), 0)
  assert(d === valorPago && c === valorPago && d === c, `comprobante cuadra: D=${d} C=${c}`)

  const disponibleOb = valorOb - valorPago
  assert(disponibleOb === 300_000, `saldo disponible de la obligación correcto: $${disponibleOb.toLocaleString()}`)

  console.log(`\nCadena completa: ${cdp.numero} → ${rp.numero} → ${obligacion.numero} → ${pago.numero} → comprobante ${comprobante!.numero}`)
  await db.$disconnect()
  await prismaMeta.$disconnect()
  console.log(process.exitCode ? "\n❌ HUBO FALLOS" : "\n✅ RP → OBLIGACIÓN → PAGO: verificado en vivo")
}

main().catch((e) => { console.error("❌ Falló:", e); process.exit(1) })

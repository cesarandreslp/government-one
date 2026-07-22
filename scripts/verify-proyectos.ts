// Verificación en vivo del Banco de Proyectos contra la BD del tenant demo: crea un proyecto,
// un hito (peso 100%), y una cadena CDP→RP→Obligación→Pago de $20M sobre un valorTotal de $40M
// vinculada al proyecto — reproduce el caso de riesgo real ya validado en personeriabuga
// (anticipo pagado 50% / obra en campo 0% = brecha +50pp, riesgo ALTO), y luego reporta el
// avance físico al 100% para confirmar que la brecha se recalcula (sobre-ejecución, riesgo BAJO).
// Uso: npx tsx scripts/verify-proyectos.ts
import "dotenv/config"
import { prismaMeta } from "../src/lib/prisma-meta"
import { getTenantPrisma } from "../src/lib/tenant-db"
import { ejecucionProyecto } from "../src/lib/proyectos/ejecucion"

function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✅" : "❌"} ${msg}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  const demo = await prismaMeta.tenant.findUnique({ where: { slug: "demo" } })
  if (!demo) throw new Error("no hay tenant demo")
  const db = await getTenantPrisma(demo.dominioPrincipal)
  if (!db) throw new Error("getTenantPrisma devolvió null")

  const dependencia = await db.dependencia.findFirst({ orderBy: { codigo: "asc" } })
  if (!dependencia) throw new Error("no hay ninguna dependencia sembrada — correr el Paso A (sembrar plantilla) primero")

  const vigencia = new Date().getUTCFullYear()
  const valorTotal = 40_000_000

  // 1) Proyecto + hito (peso 100%).
  const proyecto = await db.$transaction(async (tx) => {
    const cons = await tx.proyectoConsecutivo.upsert({
      where: { vigencia },
      create: { vigencia, ultimo: 1 },
      update: { ultimo: { increment: 1 } },
    })
    const codigo = `PRY-${vigencia}-${String(cons.ultimo).padStart(3, "0")}`
    return tx.proyecto.create({ data: { codigo, nombre: "Verificación banco de proyectos", vigencia, dependenciaId: dependencia.id, valorTotal } })
  })
  assert(/^PRY-\d{4}-\d{3}$/.test(proyecto.codigo), `Proyecto creado: ${proyecto.codigo} (valorTotal $${valorTotal.toLocaleString()})`)

  const hito = await db.proyectoHito.create({ data: { proyectoId: proyecto.id, nombre: "Entrega única", pesoPorcentual: 100 } })
  assert(Number(hito.pesoPorcentual) === 100, "hito creado con peso 100%")

  // 2) Rubro fresco (sin apropiación previa) para no interferir con el saldo de otros scripts.
  const rubro = await db.rubroPresupuestal.findFirst({
    where: { tipo: "GASTO", permiteMovimientos: true, apropiaciones: { none: { vigencia } } },
    orderBy: { codigo: "asc" },
  })
  if (!rubro) throw new Error("no hay ningún rubro de gasto libre — correr verify-presupuesto.ts primero")

  await db.apropiacion.create({ data: { rubroId: rubro.id, vigencia, apropiacionInicial: valorTotal } })

  // 3) CDP → RP → Obligación → Pago de $20M, vinculado al proyecto.
  const monto = 20_000_000
  const cdp = await db.$transaction(async (tx) => {
    const cons = await tx.cdpConsecutivo.upsert({ where: { vigencia }, create: { vigencia, ultimo: 1 }, update: { ultimo: { increment: 1 } } })
    const numero = `CDP-${vigencia}-${String(cons.ultimo).padStart(6, "0")}`
    return tx.cdp.create({ data: { numero, fecha: new Date(), vigencia, rubroId: rubro.id, valor: monto, objeto: "Anticipo verificación banco de proyectos", proyectoId: proyecto.id } })
  })
  const rp = await db.$transaction(async (tx) => {
    const cons = await tx.rpConsecutivo.upsert({ where: { vigencia }, create: { vigencia, ultimo: 1 }, update: { ultimo: { increment: 1 } } })
    const numero = `RP-${vigencia}-${String(cons.ultimo).padStart(6, "0")}`
    return tx.rp.create({ data: { numero, fecha: new Date(), vigencia, cdpId: cdp.id, valor: monto, objeto: "Anticipo" } })
  })
  const obligacion = await db.$transaction(async (tx) => {
    const cons = await tx.obligacionConsecutivo.upsert({ where: { vigencia }, create: { vigencia, ultimo: 1 }, update: { ultimo: { increment: 1 } } })
    const numero = `OB-${vigencia}-${String(cons.ultimo).padStart(6, "0")}`
    return tx.obligacion.create({ data: { numero, fecha: new Date(), rpId: rp.id, valor: monto, concepto: "Anticipo recibido a satisfacción" } })
  })

  const cuentaGasto = await db.planCuenta.findFirst({ where: { codigo: { startsWith: "5" }, permiteMovimientos: true } })
  const cuentaBanco = await db.planCuenta.findFirst({ where: { codigo: { startsWith: "11" }, permiteMovimientos: true } })
  const periodo = await db.periodoContable.findFirst({ where: { estado: "ABIERTO" } })
  if (!cuentaGasto || !cuentaBanco || !periodo) throw new Error("faltan cuentas CGC o periodo ABIERTO — correr verify-contabilidad.ts primero")

  const anio = vigencia
  await db.$transaction(async (tx) => {
    const consComp = await tx.comprobanteConsecutivo.upsert({ where: { tipo_anio: { tipo: "EGRESO", anio } }, create: { tipo: "EGRESO", anio, ultimo: 1 }, update: { ultimo: { increment: 1 } } })
    const numeroComp = `CE-${anio}-${String(consComp.ultimo).padStart(6, "0")}`
    const comprobante = await tx.comprobante.create({
      data: {
        numero: numeroComp, tipo: "EGRESO", fecha: new Date(), descripcion: `Anticipo ${obligacion.numero}: verificación banco de proyectos`,
        periodoId: periodo.id, anio, consecutivo: consComp.ultimo, totalDebito: monto, totalCredito: monto, fuenteModulo: "presupuesto",
        asientos: { create: [
          { cuentaId: cuentaGasto.id, debito: monto, credito: 0, descripcion: "Gasto ejecutado" },
          { cuentaId: cuentaBanco.id, debito: 0, credito: monto, descripcion: "Pago anticipo" },
        ] },
      },
    })
    const cons = await tx.pagoConsecutivo.upsert({ where: { vigencia: anio }, create: { vigencia: anio, ultimo: 1 }, update: { ultimo: { increment: 1 } } })
    const numero = `PG-${anio}-${String(cons.ultimo).padStart(6, "0")}`
    const pago = await tx.pago.create({ data: { numero, fecha: new Date(), obligacionId: obligacion.id, valor: monto, comprobanteId: comprobante.id } })
    await tx.comprobante.update({ where: { id: comprobante.id }, data: { fuenteRef: pago.id } })
  })

  // 4) Caso 1: anticipo pagado, obra sin iniciar.
  const ej1 = await ejecucionProyecto(db, proyecto.id, valorTotal)
  console.log(`Caso 1 — Financiera ${ej1.financiera.porcentaje}% · Física ${ej1.fisica.porcentaje}% · Brecha ${ej1.brecha}pp · Riesgo ${ej1.riesgo}`)
  assert(ej1.financiera.porcentaje === 50, `financiera 50% (pagado $${ej1.financiera.pagado.toLocaleString()} / $${valorTotal.toLocaleString()})`)
  assert(ej1.fisica.porcentaje === 0, "física 0% (hito sin reportar)")
  assert(ej1.brecha === 50, "brecha +50pp")
  assert(ej1.riesgo === "ALTO", "riesgo ALTO (anticipo pagado sin obra ejecutada)")

  // 5) Caso 2: se reporta la entrega al 100% — sobre-ejecución física, riesgo debe bajar.
  await db.$transaction(async (tx) => {
    await tx.proyectoHitoReporte.create({ data: { hitoId: hito.id, avancePorcentual: 100, observacion: "Entrega completada (verificación)" } })
    await tx.proyectoHito.update({ where: { id: hito.id }, data: { avancePorcentual: 100, fechaReporte: new Date() } })
  })
  const ej2 = await ejecucionProyecto(db, proyecto.id, valorTotal)
  console.log(`Caso 2 — Financiera ${ej2.financiera.porcentaje}% · Física ${ej2.fisica.porcentaje}% · Brecha ${ej2.brecha}pp · Riesgo ${ej2.riesgo}`)
  assert(ej2.fisica.porcentaje === 100, "física 100% tras reportar la entrega")
  assert(ej2.brecha === -50, "brecha -50pp (sobre-ejecución física)")
  assert(ej2.riesgo === "BAJO", "riesgo BAJO tras completar la obra")

  console.log(`\nCadena completa: ${proyecto.codigo} → ${cdp.numero} → ${rp.numero} → ${obligacion.numero} → comprobante EGRESO`)
  await db.$disconnect()
  await prismaMeta.$disconnect()
  console.log(process.exitCode ? "\n❌ HUBO FALLOS" : "\n✅ BANCO DE PROYECTOS: verificado en vivo")
}

main().catch((e) => { console.error("❌ Falló:", e); process.exit(1) })

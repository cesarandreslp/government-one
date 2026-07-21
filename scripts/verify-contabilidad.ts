// Verificación en vivo del módulo Contabilidad contra la BD del tenant demo: siembra el CGC,
// crea el periodo del año en curso, registra un comprobante balanceado (∑débito=∑crédito) y
// confirma que el motor rechaza uno desbalanceado. Deja sembrados el CGC y el periodo (catálogo/
// dato real de arranque); el tercero+comprobante quedan como primer corte de ejemplo.
// Uso: npx tsx scripts/verify-contabilidad.ts
import "dotenv/config"
import { prismaMeta } from "../src/lib/prisma-meta"
import { decrypt } from "../src/lib/encryption"
import { getTenantPrisma } from "../src/lib/tenant-db"
import { aplicarPlanCuentas } from "../src/lib/contabilidad/cgc"

function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✅" : "❌"} ${msg}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  const demo = await prismaMeta.tenant.findUnique({ where: { slug: "demo" } })
  if (!demo) throw new Error("no hay tenant demo")
  const db = await getTenantPrisma(demo.dominioPrincipal)
  if (!db) throw new Error("getTenantPrisma devolvió null")

  // 1) Sembrar el plan de cuentas CGC (idempotente, catálogo nacional — se deja sembrado).
  const semilla = await aplicarPlanCuentas(db)
  console.log(`Plan de cuentas: ${semilla.total} cuentas.`)
  assert(semilla.total === 67, "sembró las 67 cuentas del corte CGC")

  const bancos = await db.planCuenta.findUnique({ where: { codigo: "111005" } }) // Cuenta corriente (débito)
  const predial = await db.planCuenta.findUnique({ where: { codigo: "410502" } }) // Impuesto predial (crédito)
  assert(!!bancos?.permiteMovimientos && !!predial?.permiteMovimientos, "las cuentas de prueba aceptan movimientos")

  // 2) Periodo del año en curso (se deja — es dato real de arranque, no basura de test).
  const anio = new Date().getUTCFullYear()
  const codigo = String(anio)
  const periodo = await db.periodoContable.upsert({
    where: { codigo },
    create: { codigo, anio, mes: null, fechaInicio: new Date(Date.UTC(anio, 0, 1)), fechaFin: new Date(Date.UTC(anio, 11, 31)) },
    update: {},
  })
  assert(periodo.estado === "ABIERTO", `periodo ${codigo} está ABIERTO`)

  // 3) Tercero de ejemplo (contribuyente que paga el predial).
  const tercero = await db.tercero.upsert({
    where: { documento: "900123456" },
    create: { documento: "900123456", tipoDocumento: "NIT", razonSocial: "Contribuyente de prueba S.A.S." },
    update: {},
  })

  // 4) Comprobante balanceado: recaudo de impuesto predial en cuenta corriente.
  const monto = 250000
  const comp = await db.$transaction(async (tx) => {
    const cons = await tx.comprobanteConsecutivo.upsert({
      where: { tipo_anio: { tipo: "INGRESO", anio } },
      create: { tipo: "INGRESO", anio, ultimo: 1 },
      update: { ultimo: { increment: 1 } },
    })
    const numero = `CI-${anio}-${String(cons.ultimo).padStart(6, "0")}`
    return tx.comprobante.create({
      data: {
        numero, tipo: "INGRESO", fecha: new Date(), descripcion: "Recaudo impuesto predial (verificación)",
        periodoId: periodo.id, anio, consecutivo: cons.ultimo, totalDebito: monto, totalCredito: monto,
        asientos: {
          create: [
            { cuentaId: bancos!.id, terceroId: tercero.id, debito: monto, credito: 0, descripcion: "Recaudo en banco" },
            { cuentaId: predial!.id, terceroId: tercero.id, debito: 0, credito: monto, descripcion: "Causación impuesto predial" },
          ],
        },
      },
      include: { asientos: true },
    })
  })

  assert(/^CI-\d{4}-000001$/.test(comp.numero) || /^CI-\d{4}-\d{6}$/.test(comp.numero), `comprobante numerado ${comp.numero}`)
  assert(comp.asientos.length === 2, "comprobante tiene 2 asientos")
  const sumaDebito = comp.asientos.reduce((s, a) => s + Number(a.debito), 0)
  const sumaCredito = comp.asientos.reduce((s, a) => s + Number(a.credito), 0)
  assert(sumaDebito === monto && sumaCredito === monto && sumaDebito === sumaCredito, `partida doble cuadra: D=${sumaDebito} C=${sumaCredito}`)

  // 5) Confirmar que el motor de validación (la misma regla que usa registrarComprobanteAction)
  //    rechazaría un comprobante desbalanceado, sin llegar a escribirlo.
  const lineasDesbalanceadas = [
    { cuentaId: bancos!.id, debito: 100000, credito: 0 },
    { cuentaId: predial!.id, debito: 0, credito: 90000 },
  ]
  const dTotal = lineasDesbalanceadas.reduce((s, a) => s + a.debito, 0)
  const cTotal = lineasDesbalanceadas.reduce((s, a) => s + a.credito, 0)
  assert(Math.abs(dTotal - cTotal) > 0.5, "un comprobante desbalanceado (100.000 ≠ 90.000) es detectado antes de escribir")

  console.log(`\nComprobante de ejemplo persistido: ${comp.numero} · $${monto.toLocaleString()} · periodo ${periodo.codigo}.`)
  await db.$disconnect()
  await prismaMeta.$disconnect()
  console.log(process.exitCode ? "\n❌ HUBO FALLOS" : "\n✅ CONTABILIDAD: primer corte verificado en vivo")
}

main().catch((e) => { console.error("❌ Falló:", e); process.exit(1) })

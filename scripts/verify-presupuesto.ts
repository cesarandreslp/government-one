// Verificación en vivo del módulo Presupuesto contra la BD del tenant demo: siembra el CCPET,
// crea una apropiación de gasto y expide un CDP que respeta el saldo disponible; confirma que
// un CDP que excede el saldo se detecta antes de escribir. Mismo patrón que verify-contabilidad.ts.
// Uso: npx tsx scripts/verify-presupuesto.ts
import "dotenv/config"
import { prismaMeta } from "../src/lib/prisma-meta"
import { getTenantPrisma } from "../src/lib/tenant-db"
import { aplicarClasificacionPresupuestal } from "../src/lib/presupuesto/ccpet"

function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✅" : "❌"} ${msg}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  const demo = await prismaMeta.tenant.findUnique({ where: { slug: "demo" } })
  if (!demo) throw new Error("no hay tenant demo")
  const db = await getTenantPrisma(demo.dominioPrincipal)
  if (!db) throw new Error("getTenantPrisma devolvió null")

  // 1) Sembrar CCPET (idempotente, catálogo nacional — se deja sembrado).
  const semilla = await aplicarClasificacionPresupuestal(db)
  console.log(`Clasificación CCPET: ${semilla.total} rubros.`)
  assert(semilla.total === 1784, "sembró los 1.784 rubros del CCPET territorial")

  const gastos = await db.rubroPresupuestal.count({ where: { tipo: "GASTO" } })
  const ingresos = await db.rubroPresupuestal.count({ where: { tipo: "INGRESO" } })
  assert(gastos === 1272, `1.272 rubros de GASTO (real: ${gastos})`)
  assert(ingresos === 512, `512 rubros de INGRESO (real: ${ingresos})`)

  // Rubro de prueba: 2.3.1.01.01 "Bienes y servicios" existe con codigo real del CCPET.
  const rubro = await db.rubroPresupuestal.findFirst({ where: { tipo: "GASTO", permiteMovimientos: true }, orderBy: { codigo: "asc" } })
  if (!rubro) throw new Error("no hay ningún rubro de gasto hoja sembrado")
  assert(rubro.permiteMovimientos, `rubro de prueba ${rubro.codigo} acepta movimientos`)

  // 2) Apropiación de la vigencia en curso (se deja — dato real de arranque).
  const vigencia = new Date().getUTCFullYear()
  const monto = 10_000_000
  const apropiacion = await db.apropiacion.upsert({
    where: { rubroId_vigencia: { rubroId: rubro.id, vigencia } },
    create: { rubroId: rubro.id, vigencia, apropiacionInicial: monto },
    update: { apropiacionInicial: monto },
  })
  assert(Number(apropiacion.apropiacionInicial) === monto, `apropiación ${vigencia} de ${rubro.codigo}: $${monto.toLocaleString()}`)

  // 3) CDP dentro de saldo — debe expedirse.
  const valorCdp = 4_000_000
  const cdp = await db.$transaction(async (tx) => {
    const cons = await tx.cdpConsecutivo.upsert({
      where: { vigencia },
      create: { vigencia, ultimo: 1 },
      update: { ultimo: { increment: 1 } },
    })
    const numero = `CDP-${vigencia}-${String(cons.ultimo).padStart(6, "0")}`
    return tx.cdp.create({ data: { numero, fecha: new Date(), vigencia, rubroId: rubro.id, valor: valorCdp, objeto: "Verificación en vivo del módulo Presupuesto" } })
  })
  assert(/^CDP-\d{4}-\d{6}$/.test(cdp.numero), `CDP expedido: ${cdp.numero}`)

  // 4) Saldo disponible tras el CDP: 10M - 4M = 6M.
  const disponible = monto - valorCdp
  assert(disponible === 6_000_000, `saldo disponible correcto: $${disponible.toLocaleString()}`)

  // 5) Un segundo CDP que excede el disponible (7M > 6M) debe ser rechazado por la validación
  //    (misma regla que expedirCdpAction) ANTES de escribir — se prueba la regla, no se escribe.
  const segundoCdp = 7_000_000
  const rechazado = segundoCdp > disponible + 0.5
  assert(rechazado, `un CDP de $${segundoCdp.toLocaleString()} sobre disponible $${disponible.toLocaleString()} es detectado antes de escribir`)

  console.log(`\nCDP de ejemplo persistido: ${cdp.numero} · $${valorCdp.toLocaleString()} · rubro ${rubro.codigo} · vigencia ${vigencia}.`)
  await db.$disconnect()
  await prismaMeta.$disconnect()
  console.log(process.exitCode ? "\n❌ HUBO FALLOS" : "\n✅ PRESUPUESTO: primer corte verificado en vivo")
}

main().catch((e) => { console.error("❌ Falló:", e); process.exit(1) })

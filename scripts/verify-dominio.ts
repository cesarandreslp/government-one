// Verificación en vivo de la fundación de dominio contra la BD del tenant demo:
// aplica la plantilla ALCALDIA, monta titular→ausencia→encargo, y comprueba
// capacidadesEfectivas + quienEjerce. Limpia las tablas de organización al final.
// Uso: npx tsx scripts/verify-dominio.ts
import "dotenv/config"
import { prismaMeta } from "../src/lib/prisma-meta"
import { decrypt } from "../src/lib/encryption"
import { getTenantPrisma } from "../src/lib/tenant-db"
import { applyTenantSchema } from "../src/lib/provisioning/schema-apply"
import { aplicarPlantilla } from "../src/lib/dominio/plantillas-cargo"
import { capacidadesEfectivas, tieneCapacidad, quienEjerce } from "../src/lib/dominio/acceso"

function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✅" : "❌"} ${msg}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  const demo = await prismaMeta.tenant.findUnique({ where: { slug: "demo" } })
  if (!demo) throw new Error("no hay tenant demo (correr scripts/test-provision.ts primero)")
  if (demo.estadoProvision !== "ACTIVO") {
    await applyTenantSchema(decrypt(demo.databaseUrlDirect!))
    await prismaMeta.tenant.update({ where: { id: demo.id }, data: { estadoProvision: "ACTIVO", schemaVersion: 1 } })
  }
  const db = await getTenantPrisma(demo.dominioPrincipal)
  if (!db) throw new Error("getTenantPrisma devolvió null")

  // Limpieza previa por si quedó estado de una corrida anterior.
  await db.vinculacionCargo.deleteMany({})
  await db.ausencia.deleteMany({})
  await db.usuario.deleteMany({})
  await db.cargo.deleteMany({})
  await db.dependencia.deleteMany({})

  // 1) Sembrar la plantilla ALCALDIA
  const res = await aplicarPlantilla(db, "ALCALDIA")
  console.log(`Plantilla ALCALDIA: ${res.dependencias} dependencias, ${res.cargos} cargos.`)
  assert(res.dependencias === 7, "sembró 7 dependencias")
  assert(res.cargos >= 10, "sembró los cargos de la plantilla")

  const hac = await db.dependencia.findUnique({ where: { codigo: "HAC" } })
  const cargoSecHac = await db.cargo.findFirst({ where: { dependenciaId: hac!.id, nombre: "Secretario de Hacienda" } })
  const cargoProfPres = await db.cargo.findFirst({ where: { dependenciaId: hac!.id, nombre: "Profesional de Presupuesto" } })
  assert(!!cargoSecHac?.esJefatura, "Secretario de Hacienda es jefatura")

  // 2) Titular del cargo jefatura
  const ana = await db.usuario.create({ data: { email: "ana@demo.test", nombre: "Ana", apellido: "Ruiz" } })
  await db.vinculacionCargo.create({ data: { usuarioId: ana.id, cargoId: cargoSecHac!.id, tipo: "TITULAR" } })

  const capsAna = await capacidadesEfectivas(db, ana.id)
  assert((capsAna.presupuesto ?? []).includes("aprobar"), "Ana (titular) tiene presupuesto:aprobar vía cargo")
  assert((capsAna.ventanilla_unica ?? []).includes("responder"), "Ana tiene ventanilla_unica:responder vía cargo")

  const ejerce1 = await quienEjerce(db, cargoSecHac!.id)
  assert(ejerce1?.usuarioId === ana.id && ejerce1.via === "TITULAR", "quienEjerce → Ana (TITULAR), sin ausencia")

  // 3) Ana se ausenta; Beto queda ENCARGADO (además tiene su cargo base Profesional de Presupuesto)
  const ahora = new Date()
  await db.ausencia.create({
    data: { usuarioId: ana.id, tipo: "VACACIONES", desde: new Date(ahora.getTime() - 86400000), hasta: new Date(ahora.getTime() + 86400000) },
  })
  const beto = await db.usuario.create({ data: { email: "beto@demo.test", nombre: "Beto", apellido: "Díaz" } })
  await db.vinculacionCargo.create({ data: { usuarioId: beto.id, cargoId: cargoProfPres!.id, tipo: "TITULAR" } })
  await db.vinculacionCargo.create({ data: { usuarioId: beto.id, cargoId: cargoSecHac!.id, tipo: "ENCARGADO", actoAdmin: "Res. 123" } })

  const ejerce2 = await quienEjerce(db, cargoSecHac!.id)
  assert(ejerce2?.usuarioId === beto.id && ejerce2.via === "ENCARGADO", "quienEjerce → Beto (ENCARGADO) mientras Ana está ausente")

  const capsBeto = await capacidadesEfectivas(db, beto.id)
  assert((capsBeto.presupuesto ?? []).includes("expedir_cdp"), "Beto conserva su cargo base (presupuesto:expedir_cdp)")
  assert((capsBeto.presupuesto ?? []).includes("aprobar"), "Beto SUMA la autoridad del encargo (presupuesto:aprobar)")
  assert(await tieneCapacidad(db, beto.id, "presupuesto", "aprobar"), "tieneCapacidad(Beto, presupuesto, aprobar) = true")
  assert(!(await tieneCapacidad(db, ana.id, "contratacion", "elaborar")), "Ana NO tiene contratacion:elaborar (fuera de su cargo)")

  // Limpieza
  await db.vinculacionCargo.deleteMany({})
  await db.ausencia.deleteMany({})
  await db.usuario.deleteMany({})
  await db.cargo.deleteMany({})
  await db.dependencia.deleteMany({})
  const quedan = await db.dependencia.count()
  console.log(`Limpieza: dependencias restantes = ${quedan}`)

  await db.$disconnect()
  await prismaMeta.$disconnect()
  console.log(process.exitCode ? "\n❌ HUBO FALLOS" : "\n✅ FUNDACIÓN DE DOMINIO OK")
}

main().catch((e) => { console.error("❌ Falló:", e); process.exit(1) })

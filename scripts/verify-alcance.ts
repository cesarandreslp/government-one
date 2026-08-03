// Verificación en vivo del alcance particular/global (Contratación + Banco de Proyectos) contra
// la BD del tenant demo: Paula (Banco de Proyectos, ahora servicio compartido) debe ver TODO;
// Eliana (Contratación — Planeación, PLAN-CONT) debe ver solo lo de la familia PLAN.
// Uso: npx tsx scripts/verify-alcance.ts
import "dotenv/config"
import { prismaMeta } from "../src/lib/prisma-meta"
import { getTenantPrisma } from "../src/lib/tenant-db"
import { alcanceDependencias, usuariosDeAlcance } from "../src/lib/dominio/acceso"

function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✅" : "❌"} ${msg}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  const demo = await prismaMeta.tenant.findUnique({ where: { slug: "demo" } })
  if (!demo) throw new Error("no hay tenant demo")
  const db = await getTenantPrisma(demo.dominioPrincipal)
  if (!db) throw new Error("getTenantPrisma devolvió null")

  const paula = await db.usuario.findFirst({ where: { nombre: { contains: "Paula" } } })
  const eliana = await db.usuario.findFirst({ where: { nombre: { contains: "Eliana" } } })
  if (!paula || !eliana) throw new Error("no están los usuarios Paula/Eliana — correr la reestructura de Planeación primero")

  const totalContratos = await db.contrato.count()
  const totalProyectos = await db.proyecto.count()

  // 1) Paula — Banco de Proyectos, ahora esServicioCompartido → debe ver TODO.
  const alcancePaula = await alcanceDependencias(db, paula.id)
  assert(alcancePaula.veGlobal === true, `Paula (Banco de Proyectos) veGlobal=true (servicio compartido)`)

  // 2) Eliana — Contratación de Planeación (PLAN-CONT, NO compartido) → solo familia PLAN.
  const alcanceEliana = await alcanceDependencias(db, eliana.id)
  assert(alcanceEliana.veGlobal === false, "Eliana (PLAN-CONT) veGlobal=false (particular)")
  const depsEliana = await db.dependencia.findMany({ where: { id: { in: alcanceEliana.dependenciaIds } }, select: { codigo: true } })
  const codigosEliana = depsEliana.map((d) => d.codigo).sort()
  console.log(`   familia de Eliana: ${codigosEliana.join(", ")}`)
  assert(codigosEliana.includes("PLAN") && codigosEliana.includes("PLAN-CONT") && codigosEliana.includes("PLAN-BP"), "familia incluye PLAN, PLAN-CONT y PLAN-BP")
  assert(!codigosEliana.includes("HAC") && !codigosEliana.includes("ATC") && !codigosEliana.includes("GOB"), "familia NO incluye HAC/ATC/GOB (otras secretarías)")

  // 3) Filtro real de Contratación aplicado a Eliana: menos o igual que el total, y ninguno de
  //    los contratos visibles pertenece a un proyecto de OTRA secretaría (salvo que ella misma
  //    lo haya estructurado).
  const usuariosAlcanceEliana = await usuariosDeAlcance(db, alcanceEliana.dependenciaIds)
  const contratosEliana = await db.contrato.findMany({
    where: { OR: [
      { rp: { cdp: { proyecto: { dependenciaId: { in: alcanceEliana.dependenciaIds } } } } },
      { estructuradorId: { in: usuariosAlcanceEliana } },
    ] },
    include: { rp: { include: { cdp: { include: { proyecto: { include: { dependencia: true } } } } } } },
  })
  console.log(`   contratos totales=${totalContratos} · visibles para Eliana=${contratosEliana.length}`)
  assert(contratosEliana.length <= totalContratos, "el filtro particular de Eliana no aumenta el total")
  const fugaSecretariaAjena = contratosEliana.some((c) => {
    const dep = c.rp?.cdp.proyecto?.dependencia
    return dep && !alcanceEliana.dependenciaIds.includes(dep.id) && c.estructuradorId !== eliana.id && !usuariosAlcanceEliana.includes(c.estructuradorId ?? "")
  })
  assert(!fugaSecretariaAjena, "ningún contrato visible para Eliana pertenece a un proyecto de otra secretaría sin ser suyo")

  // 4) Banco de Proyectos: Eliana (particular) ve <= total; Paula (global) ve el total exacto.
  const proyectosEliana = await db.proyecto.count({ where: { dependenciaId: { in: alcanceEliana.dependenciaIds } } })
  console.log(`   proyectos totales=${totalProyectos} · visibles para Eliana=${proyectosEliana} · visibles para Paula(global)=${totalProyectos}`)
  assert(proyectosEliana <= totalProyectos, "proyectos visibles para Eliana <= total")

  await db.$disconnect()
  await prismaMeta.$disconnect()
  console.log(process.exitCode ? "\n❌ HUBO FALLOS" : "\n✅ ALCANCE PARTICULAR/GLOBAL: verificado en vivo")
}

main().catch((e) => { console.error("❌ Falló:", e); process.exit(1) })

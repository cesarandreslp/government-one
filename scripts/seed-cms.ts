// Siembra (idempotente) el contenido inicial de la landing en el CMS (meta-DB).
// Mueve lo que estaba quemado en src/app/page.tsx a datos editables desde el Superadmin.
// Uso: npx tsx scripts/seed-cms.ts
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const hero = {
  badge: "Plataforma SaaS · por OSS Innovation",
  titulo: "El software de gestión pública, unificado y por entidad",
  subtitulo:
    "Government One es una plataforma multi-tenant para entidades públicas colombianas: portal, gestión documental, finanzas, presupuesto, contratación y más — cada entidad con su propia base de datos aislada, activando solo lo que contrata.",
  ctaTexto: "Acceso administrativo (SaaS)",
}

const valores = {
  items: [
    { titulo: "Aislamiento fuerte por entidad", texto: "Una base de datos dedicada por entidad. Los datos de cada tenant viven separados — pensado para información personal de gobierno (Ley 1581)." },
    { titulo: "Modular por contrato", texto: "Cada entidad activa exactamente los módulos que contrata. Empieza con el portal y súmale lo que necesites sin migraciones." },
    { titulo: "Integración transparente", texto: "Al sumar un módulo, se enlaza solo: inventario y contratación postean al financiero; el banco de proyectos conoce su presupuesto." },
    { titulo: "Hecho para el sector público colombiano", texto: "Catálogos nacionales (CCPET, CGC, transparencia Res. 1519) y flujos reales de alcaldías, personerías y gobernaciones." },
  ],
}

const modulos = {
  items: [
    { nombre: "Portal Institucional", resumen: "Sitio web oficial Gov.co + Gestión Documental (base Orfeo) + Ventanilla Única con ruteo inteligente de PQRSD al funcionario que corresponde.", estado: "Fundación", capturas: [] },
    { nombre: "Financiero (Contabilidad pública)", resumen: "Libro mayor de doble partida (Marco CGN). La columna vertebral donde postean todos los módulos: presupuesto, contratación, nómina, inventarios.", estado: "Planeado", capturas: [] },
    { nombre: "Presupuesto público", resumen: "Cadena de ejecución del gasto: CDP → RP → Obligación → Pago, con catálogo CCPET y control de saldos en cada paso.", estado: "Planeado", capturas: [] },
    { nombre: "Banco de Proyectos", resumen: "Ejecución financiera vs. física de cada proyecto del plan de desarrollo. La brecha entre lo pagado y lo ejecutado como señal de riesgo.", estado: "Planeado", capturas: [] },
    { nombre: "Contratación (Ley 80/1150)", resumen: "Ciclo completo del contrato: estructuración con editor + IA, revisión jurídica, SECOP, RP, SST, supervisión e interventoría.", estado: "Planeado", capturas: [] },
    { nombre: "Nómina, Tesorería, Inventarios", resumen: "Talento humano y liquidación (PILA), conciliación bancaria, y almacén enlazado contablemente al financiero.", estado: "Planeado", capturas: [] },
  ],
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  const pagina = await prisma.paginaCms.upsert({
    where: { slug: "landing" },
    update: { titulo: "Landing pública", publicada: true },
    create: { slug: "landing", titulo: "Landing pública", publicada: true },
  })

  const bloques = [
    { clave: "hero", tipo: "hero", orden: 0, contenido: hero },
    { clave: "valores", tipo: "lista_valores", orden: 1, contenido: valores },
    { clave: "modulos", tipo: "lista_modulos", orden: 2, contenido: modulos },
  ]

  for (const b of bloques) {
    await prisma.bloqueCms.upsert({
      where: { paginaId_clave: { paginaId: pagina.id, clave: b.clave } },
      update: { tipo: b.tipo, orden: b.orden, contenido: b.contenido },
      create: { paginaId: pagina.id, clave: b.clave, tipo: b.tipo, orden: b.orden, contenido: b.contenido },
    })
  }

  console.log(`✔ CMS sembrado: página "landing" con ${bloques.length} bloques.`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

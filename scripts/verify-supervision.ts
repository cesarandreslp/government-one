// Verificación en vivo de Supervisión de Ejecución Contractual con IA, contra la BD del tenant
// demo real y la credencial de IA real del tenant (Groq) — no mocks. Crea actividades sobre un
// contrato EN_EJECUCION real, provisiona acceso de portal a su contratista, redacta un informe de
// actividad con IA (1ra persona), lo envía, y lo aprueba como supervisor (IA en 3ra persona).
// Uso: npx tsx scripts/verify-supervision.ts
import "dotenv/config"
import bcrypt from "bcryptjs"
import { prismaMeta } from "../src/lib/prisma-meta"
import { getTenantPrisma } from "../src/lib/tenant-db"
import { obtenerSecretoTenant } from "../src/lib/tenant-secretos"
import { redactarInformeActividad, redactarInformeSupervisor } from "../src/lib/ia/redactar-informe"

function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✅" : "❌"} ${msg}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  const demo = await prismaMeta.tenant.findUnique({ where: { slug: "demo" } })
  if (!demo) throw new Error("no hay tenant demo")
  const db = await getTenantPrisma(demo.dominioPrincipal)
  if (!db) throw new Error("getTenantPrisma devolvió null")

  const credencial = await obtenerSecretoTenant(demo.id, "ia")
  if (!credencial) throw new Error("el tenant demo no tiene credencial de IA configurada")
  console.log(`Usando credencial IA del tenant: proveedor=${credencial.proveedor}`)

  const contrato = await db.contrato.findFirst({ where: { estado: "EN_EJECUCION" }, include: { tercero: true } })
  if (!contrato) throw new Error("no hay ningún contrato EN_EJECUCION — correr verify-contratacion.ts primero")

  // 1) Definir actividades del contrato.
  const actividad = await db.contratoActividad.create({
    data: { contratoId: contrato.id, descripcion: "Verificación del portal — instalación y configuración del sistema de alumbrado público del sector piloto", orden: 1 },
  })
  assert(!!actividad.id, `Actividad creada sobre ${contrato.numero}: "${actividad.descripcion.slice(0, 40)}…"`)

  // 2) Dar acceso al portal al contratista (Usuario CONTRATISTA vinculado por terceroId).
  const email = "contratista.verificacion@demo.gov.co"
  const passwordHash = await bcrypt.hash("ClaveDePrueba2026!", 12)
  const usuarioContratista = await db.usuario.upsert({
    where: { email },
    create: { email, nombre: "Contratista", apellido: "Verificación", rol: "CONTRATISTA", terceroId: contrato.terceroId, passwordHash },
    update: { rol: "CONTRATISTA", terceroId: contrato.terceroId, passwordHash, activo: true },
  })
  assert(usuarioContratista.terceroId === contrato.terceroId, `Usuario CONTRATISTA creado, vinculado al Tercero de ${contrato.tercero.razonSocial}`)

  const okPassword = await bcrypt.compare("ClaveDePrueba2026!", usuarioContratista.passwordHash!)
  assert(okPassword && usuarioContratista.rol === "CONTRATISTA", "el contratista puede autenticarse con la contraseña fijada (mismo bcrypt que tenant-auth.ts)")

  // 3) Crear informe (BORRADOR) y redactar el reporte de la actividad con IA real (1ra persona).
  const ultimoInforme = await db.informeSupervision.findFirst({ where: { contratoId: contrato.id }, orderBy: { numero: "desc" } })
  const informe = await db.informeSupervision.create({ data: { contratoId: contrato.id, numero: (ultimoInforme?.numero ?? 0) + 1, periodo: "Agosto 2026 (verificación)" } })
  assert(informe.estado === "BORRADOR", `Informe N.° ${informe.numero} creado en BORRADOR`)

  const descripcionContratista = "Instalé 12 luminarias LED nuevas en el sector piloto, retiré las lámparas de sodio antiguas, verifiqué el correcto funcionamiento del sistema fotocontrol y dejé registro fotográfico de cada punto intervenido."
  const textoIA = await redactarInformeActividad(actividad.descripcion, descripcionContratista, credencial)
  assert(!!textoIA && textoIA.length > 100, `IA redactó el informe de actividad en 1ra persona (${textoIA?.length ?? 0} caracteres)`)
  // Nota: sin \b final — en regex JS (sin flag u) los acentos no cuentan como \w, así que un \b
  // justo después de "é" no coincide nunca (falso negativo, no problema del texto generado).
  const primeraPersona = /\b(instal[eé]|realic[eé]|efectu[eé]|verifiqu[eé]|entregu[eé]|retir[eé]|proced[ií])/i.test(textoIA ?? "")
  if (!primeraPersona) console.log("   [texto real, para depurar el regex]:\n", textoIA)
  assert(primeraPersona, "el texto usa verbos en 1ra persona (instalé/realicé/verifiqué...)")
  const parrafos = (textoIA ?? "").split(/\n\s*\n/).filter((p) => p.trim().length > 0)
  console.log(`   párrafos generados: ${parrafos.length}`)

  await db.actividadReporte.create({
    data: { informeId: informe.id, actividadId: actividad.id, descripcionContratista, textoIA, evidenciaUrl: "https://ejemplo.gov.co/evidencias/verificacion.pdf" },
  })

  // 4) Enviar el informe (BORRADOR → ENVIADO).
  await db.informeSupervision.update({ where: { id: informe.id }, data: { estado: "ENVIADO" } })
  const enviado = await db.informeSupervision.findUnique({ where: { id: informe.id } })
  assert(enviado?.estado === "ENVIADO", "informe pasó a ENVIADO")

  // 5) Devolución del supervisor (ciclo, mismo patrón que revisión jurídica) — sin generar IA.
  await db.informeSupervision.update({ where: { id: informe.id }, data: { estado: "DEVUELTO", observaciones: "Falta evidencia del punto 5 (verificación)." } })
  const devuelto = await db.informeSupervision.findUnique({ where: { id: informe.id } })
  assert(devuelto?.estado === "DEVUELTO" && !!devuelto.observaciones, "informe devuelto con observaciones — el contratista podría corregir y reenviar")

  // 6) Reenvío y aprobación — la IA redacta el informe del supervisor en 3ra persona.
  await db.informeSupervision.update({ where: { id: informe.id }, data: { estado: "ENVIADO" } })
  const actividadesParaSupervisor = [{ descripcion: actividad.descripcion, textoContratista: textoIA ?? descripcionContratista }]
  const textoSupervisorIA = await redactarInformeSupervisor(contrato.tercero.razonSocial, contrato.numero, actividadesParaSupervisor, credencial)
  assert(!!textoSupervisorIA && textoSupervisorIA.length > 100, `IA redactó el informe del supervisor en 3ra persona (${textoSupervisorIA?.length ?? 0} caracteres)`)
  const mencionaContratista = (textoSupervisorIA ?? "").includes(contrato.tercero.razonSocial)
  assert(mencionaContratista, `el informe del supervisor menciona explícitamente al contratista ("${contrato.tercero.razonSocial}")`)
  const terceraPersona = /\bel contratista\b|\bejecut[óo]\b|\brealiz[óo]\b/i.test(textoSupervisorIA ?? "")
  assert(terceraPersona, "el texto usa 3ra persona (ejecutó/realizó/\"el contratista\"...)")

  await db.informeSupervision.update({ where: { id: informe.id }, data: { estado: "APROBADO", textoSupervisorIA, decididoPor: "script-verificacion", fechaDecision: new Date() } })
  const aprobado = await db.informeSupervision.findUnique({ where: { id: informe.id } })
  assert(aprobado?.estado === "APROBADO" && !!aprobado.textoSupervisorIA, "informe quedó APROBADO con el informe del supervisor guardado")

  console.log(`\nCiclo completo: actividad → informe BORRADOR → ENVIADO → DEVUELTO → ENVIADO → APROBADO (con 2 redacciones de IA reales)`)
  await db.$disconnect()
  await prismaMeta.$disconnect()
  console.log(process.exitCode ? "\n❌ HUBO FALLOS" : "\n✅ SUPERVISIÓN DE EJECUCIÓN: verificado en vivo con IA real")
}

main().catch((e) => { console.error("❌ Falló:", e); process.exit(1) })

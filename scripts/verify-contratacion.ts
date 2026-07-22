// Verificación en vivo de Contratación contra la BD del tenant demo: (A) prueba pura la máquina
// de estados + gating por persona (puedeAvanzarContrato, sin tocar la BD); (B) recorre un
// contrato real de punta a punta usando personas reales del tenant (Beatriz Torres como
// estructuradora vía su encargo de Planeación, un profesional jurídico vinculado para la
// revisión) y confirma que un tercero SIN la asignación correcta es rechazado.
// Uso: npx tsx scripts/verify-contratacion.ts
import "dotenv/config"
import { prismaMeta } from "../src/lib/prisma-meta"
import { getTenantPrisma } from "../src/lib/tenant-db"
import { tieneCapacidad } from "../src/lib/dominio/acceso"
import { puedeAvanzarContrato, type EstadoContrato } from "../src/lib/contratacion/flujo"

function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✅" : "❌"} ${msg}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  const demo = await prismaMeta.tenant.findUnique({ where: { slug: "demo" } })
  if (!demo) throw new Error("no hay tenant demo")
  const db = await getTenantPrisma(demo.dominioPrincipal)
  if (!db) throw new Error("getTenantPrisma devolvió null")

  // ── A) Máquina de estados + gating, en abstracto (sin BD) ──────────────────────────────
  const contratoFicticio = { estructuradorId: "estr-1", abogadoAsignadoId: "abg-1" }
  assert(
    puedeAvanzarContrato(contratoFicticio, "BORRADOR", "EN_REVISION_JURIDICA", { usuarioId: "estr-1", esAdminTenant: false, puedeElaborar: true, puedeRevisarJuridica: false, puedeConceptoJuridico: false, puedeAprobar: false, puedeSupervisar: false }) === null,
    "el estructurador asignado, con capacidad elaborar, SÍ puede enviar a revisión",
  )
  assert(
    puedeAvanzarContrato(contratoFicticio, "BORRADOR", "EN_REVISION_JURIDICA", { usuarioId: "otro", esAdminTenant: false, puedeElaborar: true, puedeRevisarJuridica: false, puedeConceptoJuridico: false, puedeAprobar: false, puedeSupervisar: false }) !== null,
    "otra persona con capacidad elaborar pero SIN ser el estructurador asignado es rechazada",
  )
  assert(
    puedeAvanzarContrato(contratoFicticio, "BORRADOR", "EN_REVISION_JURIDICA", { usuarioId: "estr-1", esAdminTenant: false, puedeElaborar: false, puedeRevisarJuridica: false, puedeConceptoJuridico: false, puedeAprobar: false, puedeSupervisar: false }) !== null,
    "el estructurador asignado SIN la capacidad elaborar (se la quitaron) es rechazado",
  )
  assert(
    puedeAvanzarContrato(contratoFicticio, "EN_REVISION_JURIDICA", "PERFECCIONADO", { usuarioId: "abg-1", esAdminTenant: false, puedeElaborar: false, puedeRevisarJuridica: true, puedeConceptoJuridico: false, puedeAprobar: false, puedeSupervisar: false }) === null,
    "el abogado asignado SÍ puede perfeccionar",
  )
  assert(
    puedeAvanzarContrato(contratoFicticio, "EN_REVISION_JURIDICA", "PERFECCIONADO", { usuarioId: "otro-abogado", esAdminTenant: false, puedeElaborar: false, puedeRevisarJuridica: true, puedeConceptoJuridico: false, puedeAprobar: false, puedeSupervisar: false }) !== null,
    "otro abogado con capacidad pero SIN ser el asignado a ESTE contrato es rechazado",
  )
  assert(
    puedeAvanzarContrato(contratoFicticio, "BORRADOR", "PERFECCIONADO", { usuarioId: "estr-1", esAdminTenant: true, puedeElaborar: true, puedeRevisarJuridica: true, puedeConceptoJuridico: true, puedeAprobar: true, puedeSupervisar: true }) !== null,
    "saltarse un paso (BORRADOR→PERFECCIONADO directo) se rechaza SIEMPRE, incluso siendo admin",
  )
  assert(
    puedeAvanzarContrato(contratoFicticio, "BORRADOR", "EN_REVISION_JURIDICA", { usuarioId: "cualquiera", esAdminTenant: true, puedeElaborar: false, puedeRevisarJuridica: false, puedeConceptoJuridico: false, puedeAprobar: false, puedeSupervisar: false }) === null,
    "el admin del tenant sí tiene el override de soporte para una transición válida",
  )

  // ── B) Punta a punta contra la BD real, con personas reales del tenant ─────────────────
  const beatriz = await db.usuario.findFirst({ where: { nombre: "Beatriz" } })
  if (!beatriz) throw new Error("no existe Beatriz Torres — correr verify-dominio.ts / Paso A primero")
  const puedeBeatrizElaborar = await tieneCapacidad(db, beatriz.id, "contratacion", "elaborar")
  assert(puedeBeatrizElaborar, "Beatriz Torres tiene capacidad contratacion:elaborar vía su encargo de Planeación")

  const cargoJuridico = await db.cargo.findFirst({ where: { nombre: "Profesional Jurídico" } })
  if (!cargoJuridico) throw new Error("no existe el cargo 'Profesional Jurídico' — correr la siembra de la plantilla ALCALDIA")
  const abogado = await db.usuario.upsert({
    where: { email: "abogado.demo@gov1.test" },
    create: { email: "abogado.demo@gov1.test", nombre: "Andrés", apellido: "Rojas" },
    update: {},
  })
  const yaVinculado = await db.vinculacionCargo.findFirst({ where: { usuarioId: abogado.id, cargoId: cargoJuridico.id, hasta: null } })
  if (!yaVinculado) await db.vinculacionCargo.create({ data: { usuarioId: abogado.id, cargoId: cargoJuridico.id, tipo: "TITULAR" } })
  const puedeAbogadoRevisar = await tieneCapacidad(db, abogado.id, "contratacion", "revisar_juridica")
  assert(puedeAbogadoRevisar, "Andrés Rojas (Profesional Jurídico) tiene capacidad contratacion:revisar_juridica")

  const tercero = await db.tercero.findFirst()
  if (!tercero) throw new Error("no hay ningún tercero — correr verify-contabilidad.ts primero")

  const vigencia = new Date().getUTCFullYear()
  const contrato = await db.$transaction(async (tx) => {
    const cons = await tx.contratoConsecutivo.upsert({ where: { vigencia }, create: { vigencia, ultimo: 1 }, update: { ultimo: { increment: 1 } } })
    const numero = `C-${vigencia}-${String(cons.ultimo).padStart(3, "0")}`
    return tx.contrato.create({
      data: { numero, vigencia, objeto: "Verificación en vivo de Contratación", modalidad: "CONTRATACION_DIRECTA", valorContrato: 15_000_000, terceroId: tercero.id, estructuradorId: beatriz.id },
    })
  })
  assert(/^C-\d{4}-\d{3}$/.test(contrato.numero) && contrato.estado === "BORRADOR", `Contrato creado: ${contrato.numero} (BORRADOR)`)

  // Un tercero sin ser el estructurador asignado NO puede enviarlo a revisión, aunque tenga la capacidad.
  const actorAbogadoIntentaEnviar = { usuarioId: abogado.id, esAdminTenant: false, puedeElaborar: false, puedeRevisarJuridica: true, puedeConceptoJuridico: false, puedeAprobar: false, puedeSupervisar: false }
  const bloqueo1 = puedeAvanzarContrato(contrato, contrato.estado as EstadoContrato, "EN_REVISION_JURIDICA", actorAbogadoIntentaEnviar)
  assert(bloqueo1 !== null, `el abogado (sin ser el estructurador) es rechazado al intentar avanzar ${contrato.numero}: "${bloqueo1}"`)

  // Beatriz (estructuradora asignada, con capacidad) sí puede.
  const actorBeatriz = { usuarioId: beatriz.id, esAdminTenant: false, puedeElaborar: true, puedeRevisarJuridica: false, puedeConceptoJuridico: false, puedeAprobar: false, puedeSupervisar: false }
  const bloqueo2 = puedeAvanzarContrato(contrato, contrato.estado as EstadoContrato, "EN_REVISION_JURIDICA", actorBeatriz)
  assert(bloqueo2 === null, "Beatriz (estructuradora asignada) puede enviar a revisión jurídica")

  await db.$transaction(async (tx) => {
    await tx.contratoVersion.create({ data: { contratoId: contrato.id, numeroVersion: 1, tipo: "BORRADOR_ESTRUCTURACION", contenido: "Estudios previos y minuta del contrato (verificación).", autorId: beatriz.id } })
    await tx.contrato.update({ where: { id: contrato.id }, data: { estado: "EN_REVISION_JURIDICA", abogadoAsignadoId: abogado.id } })
  })

  const actorAbogado = { usuarioId: abogado.id, esAdminTenant: false, puedeElaborar: false, puedeRevisarJuridica: true, puedeConceptoJuridico: false, puedeAprobar: false, puedeSupervisar: false }
  const bloqueo3 = puedeAvanzarContrato({ ...contrato, abogadoAsignadoId: abogado.id }, "EN_REVISION_JURIDICA", "PERFECCIONADO", actorAbogado)
  assert(bloqueo3 === null, "Andrés (abogado asignado) puede perfeccionar el contrato")

  await db.$transaction(async (tx) => {
    await tx.contratoVersion.create({ data: { contratoId: contrato.id, numeroVersion: 2, tipo: "REVISION_JURIDICA", aprobado: true, observaciones: "Cumple requisitos legales (verificación).", autorId: abogado.id } })
    await tx.contrato.update({ where: { id: contrato.id }, data: { estado: "PERFECCIONADO" } })
  })

  await db.contrato.update({ where: { id: contrato.id }, data: { estado: "SUSCRITO", fechaSuscripcion: new Date() } })
  await db.contrato.update({ where: { id: contrato.id }, data: { estado: "EN_EJECUCION" } })

  const final = await db.contrato.findUnique({ where: { id: contrato.id }, include: { versiones: true } })
  assert(final?.estado === "EN_EJECUCION", `${contrato.numero} llegó a EN_EJECUCION recorriendo toda la cadena`)
  assert(final?.versiones.length === 2, "quedaron 2 versiones (borrador de estructuración + revisión jurídica aprobada)")

  console.log(`\nCadena completa: ${contrato.numero} BORRADOR → EN_REVISION_JURIDICA → PERFECCIONADO → SUSCRITO → EN_EJECUCION`)
  await db.$disconnect()
  await prismaMeta.$disconnect()
  console.log(process.exitCode ? "\n❌ HUBO FALLOS" : "\n✅ CONTRATACIÓN: verificado en vivo (máquina de estados + gating por persona)")
}

main().catch((e) => { console.error("❌ Falló:", e); process.exit(1) })

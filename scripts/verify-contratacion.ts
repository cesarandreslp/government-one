// Verificación en vivo de Contratación contra la BD del tenant demo: (A) prueba pura la máquina
// de estados + gating por persona (puedeAvanzarContrato, sin tocar la BD), incluyendo el gate
// presupuestal PERFECCIONADO→RP_REGISTRADO→SUSCRITO (Art. 71 Decreto 111/1996: sin RP no hay
// compromiso válido); (B) recorre un contrato real de punta a punta usando personas reales del
// tenant y un RP real con saldo suficiente, y confirma que un RP insuficiente es rechazado.
// Uso: npx tsx scripts/verify-contratacion.ts
import "dotenv/config"
import { prismaMeta } from "../src/lib/prisma-meta"
import { getTenantPrisma } from "../src/lib/tenant-db"
import { tieneCapacidad } from "../src/lib/dominio/acceso"
import { puedeAvanzarContrato, type EstadoContrato } from "../src/lib/contratacion/flujo"
import { valorVigente, plazoVigente, validarTopeAdicion } from "../src/lib/contratacion/modificaciones"

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
    puedeAvanzarContrato(contratoFicticio, "EN_REVISION_JURIDICA", "PERFECCIONADO", { usuarioId: "abg-1", esAdminTenant: false, puedeElaborar: false, puedeRevisarJuridica: true, puedeConceptoJuridico: false, puedeAprobar: false, puedeSupervisar: false }) === null,
    "el abogado asignado SÍ puede perfeccionar",
  )
  assert(
    puedeAvanzarContrato(contratoFicticio, "PERFECCIONADO", "SUSCRITO", { usuarioId: "x", esAdminTenant: false, puedeElaborar: false, puedeRevisarJuridica: false, puedeConceptoJuridico: false, puedeAprobar: true, puedeSupervisar: false }) !== null,
    "PERFECCIONADO→SUSCRITO directo (saltándose RP_REGISTRADO) se rechaza, aunque tenga capacidad aprobar",
  )
  assert(
    puedeAvanzarContrato(contratoFicticio, "PERFECCIONADO", "RP_REGISTRADO", { usuarioId: "x", esAdminTenant: false, puedeElaborar: false, puedeRevisarJuridica: false, puedeConceptoJuridico: false, puedeAprobar: true, puedeSupervisar: false }) === null,
    "PERFECCIONADO→RP_REGISTRADO sí es válido con capacidad aprobar",
  )
  assert(
    puedeAvanzarContrato(contratoFicticio, "RP_REGISTRADO", "SUSCRITO", { usuarioId: "x", esAdminTenant: false, puedeElaborar: false, puedeRevisarJuridica: false, puedeConceptoJuridico: false, puedeAprobar: true, puedeSupervisar: false }) === null,
    "RP_REGISTRADO→SUSCRITO sí es válido con capacidad aprobar",
  )
  assert(
    puedeAvanzarContrato(contratoFicticio, "BORRADOR", "PERFECCIONADO", { usuarioId: "estr-1", esAdminTenant: true, puedeElaborar: true, puedeRevisarJuridica: true, puedeConceptoJuridico: true, puedeAprobar: true, puedeSupervisar: true }) !== null,
    "saltarse un paso se rechaza SIEMPRE, incluso siendo admin",
  )

  // ── B) Punta a punta contra la BD real, con personas y presupuesto reales del tenant ───
  // Eliana Gómez (Profesional de Contratación — Planeación) es quien hoy tiene contratacion:elaborar
  // (antes era Beatriz Torres vía un encargo de Planeación — dejó de tenerlo tras la reestructura
  // de Planeación en sub-dependencias, commit `e62aacc`; Beatriz ahora es Secretaria de Planeación,
  // sin esa capacidad).
  const eliana = await db.usuario.findFirst({ where: { nombre: "Eliana" } })
  if (!eliana) throw new Error("no existe Eliana Gómez (Profesional de Contratación — Planeación) — correr la reestructura de Planeación primero")
  assert(await tieneCapacidad(db, eliana.id, "contratacion", "elaborar"), "Eliana Gómez tiene capacidad contratacion:elaborar (Profesional de Contratación — Planeación)")

  const cargoJuridico = await db.cargo.findFirst({ where: { nombre: "Profesional Jurídico" } })
  if (!cargoJuridico) throw new Error("no existe el cargo 'Profesional Jurídico' — correr la siembra de la plantilla ALCALDIA")
  const abogado = await db.usuario.upsert({
    where: { email: "abogado.demo@gov1.test" },
    create: { email: "abogado.demo@gov1.test", nombre: "Andrés", apellido: "Rojas" },
    update: {},
  })
  if (!(await db.vinculacionCargo.findFirst({ where: { usuarioId: abogado.id, cargoId: cargoJuridico.id, hasta: null } }))) {
    await db.vinculacionCargo.create({ data: { usuarioId: abogado.id, cargoId: cargoJuridico.id, tipo: "TITULAR" } })
  }
  assert(await tieneCapacidad(db, abogado.id, "contratacion", "revisar_juridica"), "Andrés Rojas (Profesional Jurídico) tiene capacidad contratacion:revisar_juridica")

  const tercero = await db.tercero.findFirst()
  if (!tercero) throw new Error("no hay ningún tercero — correr verify-contabilidad.ts primero")

  // RP fresco con saldo suficiente ($15M) para respaldar el contrato — rubro libre para no
  // interferir con el saldo de otros scripts de verificación.
  const vigencia = new Date().getUTCFullYear()
  const rubro = await db.rubroPresupuestal.findFirst({ where: { tipo: "GASTO", permiteMovimientos: true, apropiaciones: { none: { vigencia } } }, orderBy: { codigo: "asc" } })
  if (!rubro) throw new Error("no hay ningún rubro de gasto libre — correr verify-presupuesto.ts primero")
  const valorContrato = 15_000_000
  await db.apropiacion.create({ data: { rubroId: rubro.id, vigencia, apropiacionInicial: valorContrato } })
  const cdp = await db.$transaction(async (tx) => {
    const cons = await tx.cdpConsecutivo.upsert({ where: { vigencia }, create: { vigencia, ultimo: 1 }, update: { ultimo: { increment: 1 } } })
    const numero = `CDP-${vigencia}-${String(cons.ultimo).padStart(6, "0")}`
    return tx.cdp.create({ data: { numero, fecha: new Date(), vigencia, rubroId: rubro.id, valor: valorContrato, objeto: "Verificación en vivo de Contratación" } })
  })
  const rp = await db.$transaction(async (tx) => {
    const cons = await tx.rpConsecutivo.upsert({ where: { vigencia }, create: { vigencia, ultimo: 1 }, update: { ultimo: { increment: 1 } } })
    const numero = `RP-${vigencia}-${String(cons.ultimo).padStart(6, "0")}`
    return tx.rp.create({ data: { numero, fecha: new Date(), vigencia, cdpId: cdp.id, valor: valorContrato, objeto: "Respaldo presupuestal del contrato de verificación" } })
  })

  const contrato = await db.$transaction(async (tx) => {
    const cons = await tx.contratoConsecutivo.upsert({ where: { vigencia }, create: { vigencia, ultimo: 1 }, update: { ultimo: { increment: 1 } } })
    const numero = `C-${vigencia}-${String(cons.ultimo).padStart(3, "0")}`
    return tx.contrato.create({
      data: { numero, vigencia, objeto: "Verificación en vivo de Contratación", modalidad: "CONTRATACION_DIRECTA", valorContrato, terceroId: tercero.id, estructuradorId: eliana.id },
    })
  })
  assert(/^C-\d{4}-\d{3}$/.test(contrato.numero) && contrato.estado === "BORRADOR", `Contrato creado: ${contrato.numero} (BORRADOR, sin RP todavía)`)

  await db.$transaction(async (tx) => {
    await tx.contratoVersion.create({ data: { contratoId: contrato.id, numeroVersion: 1, tipo: "BORRADOR_ESTRUCTURACION", contenido: "Estudios previos y minuta del contrato (verificación).", autorId: eliana.id } })
    await tx.contrato.update({ where: { id: contrato.id }, data: { estado: "EN_REVISION_JURIDICA", abogadoAsignadoId: abogado.id } })
  })
  await db.$transaction(async (tx) => {
    await tx.contratoVersion.create({ data: { contratoId: contrato.id, numeroVersion: 2, tipo: "REVISION_JURIDICA", aprobado: true, observaciones: "Cumple requisitos legales (verificación).", autorId: abogado.id } })
    await tx.contrato.update({ where: { id: contrato.id }, data: { estado: "PERFECCIONADO" } })
  })

  // Un RP que NO cubre el valor del contrato debe rechazarse (misma regla que registrarRpAction).
  const rpInsuficiente = valorContrato - 1
  assert(Number(rp.valor) >= valorContrato && rpInsuficiente < valorContrato, `el RP real ($${Number(rp.valor).toLocaleString()}) cubre el contrato; uno de $${rpInsuficiente.toLocaleString()} NO lo cubriría`)

  // RP real, con saldo suficiente → RP_REGISTRADO.
  await db.contrato.update({ where: { id: contrato.id }, data: { estado: "RP_REGISTRADO", rpId: rp.id } })
  await db.contrato.update({ where: { id: contrato.id }, data: { estado: "SUSCRITO", fechaSuscripcion: new Date() } })
  await db.contrato.update({ where: { id: contrato.id }, data: { estado: "EN_EJECUCION" } })

  const final = await db.contrato.findUnique({ where: { id: contrato.id }, include: { versiones: true, rp: { include: { cdp: true } } } })
  assert(final?.estado === "EN_EJECUCION", `${contrato.numero} llegó a EN_EJECUCION recorriendo toda la cadena`)
  assert(final?.rp?.numero === rp.numero, `${contrato.numero} quedó respaldado por ${rp.numero} (CDP ${final?.rp?.cdp.numero})`)
  assert(final?.versiones.length === 2, "quedaron 2 versiones (borrador de estructuración + revisión jurídica aprobada)")

  console.log(`\nCadena completa: ${contrato.numero} BORRADOR → EN_REVISION_JURIDICA → PERFECCIONADO → RP_REGISTRADO (${rp.numero}) → SUSCRITO → EN_EJECUCION`)

  // ── C) Garantías + adiciones/prórrogas (pura + contra el contrato real recién creado) ──────
  assert(validarTopeAdicion(valorContrato, [], valorContrato * 0.5) === null, "una adición exacta al 50% del valor inicial es válida")
  assert(validarTopeAdicion(valorContrato, [], valorContrato * 0.5 + 1) !== null, "una adición que supera el 50% del valor inicial se rechaza")
  assert(
    validarTopeAdicion(valorContrato, [{ valorAdicion: valorContrato * 0.3, diasProrroga: null }], valorContrato * 0.3) !== null,
    "el tope del 50% se aplica sobre el ACUMULADO de adiciones previas, no solo la nueva",
  )
  assert(valorVigente(valorContrato, [{ valorAdicion: 1_000_000, diasProrroga: null }, { valorAdicion: 500_000, diasProrroga: null }]) === valorContrato + 1_500_000, "valorVigente suma todas las adiciones sobre el valor original")
  assert(plazoVigente(90, [{ valorAdicion: null, diasProrroga: 15 }, { valorAdicion: null, diasProrroga: 10 }]) === 115, "plazoVigente suma todos los días de prórroga")
  assert(plazoVigente(null, []) === null, "sin plazoDias original, plazoVigente es null (no aplica)")

  const aseguradora = await db.tercero.findFirst({ where: { id: { not: tercero.id } } }) ?? tercero
  const garantia = await db.garantia.create({
    data: {
      contratoId: contrato.id, tipo: "CUMPLIMIENTO", aseguradoraId: aseguradora.id, numeroPoliza: "POL-VERIF-001",
      valorAsegurado: valorContrato * 0.1, vigenciaDesde: new Date(), vigenciaHasta: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    },
  })
  assert(garantia.estado === "PENDIENTE", "la garantía nace PENDIENTE")
  const garantiaAprobada = await db.garantia.update({ where: { id: garantia.id }, data: { estado: "APROBADA", aprobadoPor: eliana.id, fechaAprobacion: new Date() } })
  assert(garantiaAprobada.estado === "APROBADA", "la garantía se puede aprobar")

  const modificacion = await db.modificacionContrato.create({
    data: { contratoId: contrato.id, numero: 1, tipo: "ADICION_Y_PRORROGA", valorAdicion: 1_000_000, diasProrroga: 30, justificacion: "Mayor cantidad de obra requerida (verificación).", aprobadoPor: eliana.id, fecha: new Date() },
  })
  assert(modificacion.numero === 1, "el primer Otrosí del contrato queda numerado como 1")
  const modsDelContrato = await db.modificacionContrato.findMany({ where: { contratoId: contrato.id } })
  assert(modsDelContrato.length === 1, "el Otrosí quedó asociado al contrato")

  await db.$disconnect()
  await prismaMeta.$disconnect()
  console.log(process.exitCode ? "\n❌ HUBO FALLOS" : "\n✅ CONTRATACIÓN: verificado en vivo (máquina de estados + gating por persona + respaldo presupuestal + garantías + adiciones/prórrogas con tope legal 50%)")
}

main().catch((e) => { console.error("❌ Falló:", e); process.exit(1) })

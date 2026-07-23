"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

// Acciones de TALENTO HUMANO (RRHH): alta de funcionarios y actos administrativos
// (nombramiento/posesión, encargo, provisional, vacaciones/licencias). Gating por CAPACIDAD
// (gestion_humana:gestionar_funcionarios / actos_administrativos), no por rol de identidad —
// así opera la dependencia real de Talento Humano, no el admin del tenant. Ver dal-tenant.ts.

const MODULO = "gestion_humana"
const VINC_TIPOS = ["TITULAR", "ENCARGADO", "PROVISIONAL"]
const AUSENCIA_TIPOS = ["VACACIONES", "LICENCIA", "COMISION", "INCAPACIDAD"]
const TIPOS_DOCUMENTO = ["CC", "CE", "PA", "NIT", "OTRO"]

export interface AccionState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function crearFuncionarioAction(_prev: AccionState, formData: FormData): Promise<AccionState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "gestionar_funcionarios"))) {
    return { ok: false, error: "No tienes la capacidad para vincular funcionarios." }
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const nombre = String(formData.get("nombre") ?? "").trim()
  const apellido = String(formData.get("apellido") ?? "").trim()
  const documento = String(formData.get("documento") ?? "").trim() || null
  const tipoDocumentoRaw = String(formData.get("tipoDocumento") ?? "").trim()
  const tipoDocumento = TIPOS_DOCUMENTO.includes(tipoDocumentoRaw) ? tipoDocumentoRaw : null

  if (!email || !nombre || !apellido) return { ok: false, error: "Correo, nombre y apellido son obligatorios." }

  try {
    await ctx.db.usuario.create({ data: { email, nombre, apellido, rol: "USER", documento, tipoDocumento: tipoDocumento as never } })
    revalidatePath("/admin/rrhh")
    return { ok: true, mensaje: `Funcionario "${nombre} ${apellido}" creado. Ahora regístrale un acto administrativo para vincularlo a un cargo.` }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique")
      ? (e.message.includes("documento") ? `El documento "${documento}" ya está registrado.` : `El correo "${email}" ya está registrado.`)
      : "Error al crear el funcionario."
    return { ok: false, error: msg }
  }
}

export async function registrarActoAction(_prev: AccionState, formData: FormData): Promise<AccionState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "actos_administrativos"))) {
    return { ok: false, error: "No tienes la capacidad para registrar actos administrativos." }
  }
  const usuarioId = String(formData.get("usuarioId") ?? "").trim()
  const cargoId = String(formData.get("cargoId") ?? "").trim()
  const tipo = String(formData.get("tipo") ?? "TITULAR").trim()
  const actoAdmin = String(formData.get("actoAdmin") ?? "").trim()
  const desdeRaw = String(formData.get("desde") ?? "").trim()
  const hastaRaw = String(formData.get("hasta") ?? "").trim()
  const salarioRaw = String(formData.get("salarioBasico") ?? "").trim()

  if (!usuarioId || !cargoId) return { ok: false, error: "Funcionario y cargo son obligatorios." }
  if (!VINC_TIPOS.includes(tipo)) return { ok: false, error: "Tipo de acto inválido." }
  if (!actoAdmin) return { ok: false, error: "El acto administrativo (resolución/decreto) es obligatorio." }
  const desde = desdeRaw ? new Date(desdeRaw) : new Date()
  const hasta = hastaRaw ? new Date(hastaRaw) : null
  if (hasta && hasta < desde) return { ok: false, error: "La fecha \"hasta\" no puede ser anterior a \"desde\"." }
  const salarioBasico = salarioRaw ? Number(salarioRaw) : null
  if (salarioRaw && (!Number.isFinite(salarioBasico) || salarioBasico! <= 0)) {
    return { ok: false, error: "El salario debe ser un número mayor a 0." }
  }

  try {
    await ctx.db.vinculacionCargo.create({
      data: { usuarioId, cargoId, tipo: tipo as never, actoAdmin, desde, hasta, salarioBasico },
    })
    revalidatePath("/admin/rrhh")
    return { ok: true, mensaje: "Acto administrativo registrado." }
  } catch {
    return { ok: false, error: "Error al registrar el acto (¿funcionario y cargo válidos?)." }
  }
}

/** Fija/corrige el salario de una vinculación ya registrada (backfill o reajuste salarial). */
export async function actualizarSalarioAction(_prev: AccionState, formData: FormData): Promise<AccionState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "actos_administrativos"))) {
    return { ok: false, error: "No tienes la capacidad para actualizar salarios." }
  }
  const vinculacionId = String(formData.get("vinculacionId") ?? "").trim()
  const salarioRaw = String(formData.get("salarioBasico") ?? "").trim()
  const salarioBasico = Number(salarioRaw)
  if (!vinculacionId) return { ok: false, error: "Selecciona el vínculo a actualizar." }
  if (!Number.isFinite(salarioBasico) || salarioBasico <= 0) return { ok: false, error: "El salario debe ser un número mayor a 0." }

  try {
    await ctx.db.vinculacionCargo.update({ where: { id: vinculacionId }, data: { salarioBasico } })
    revalidatePath("/admin/rrhh")
    return { ok: true, mensaje: "Salario actualizado." }
  } catch {
    return { ok: false, error: "Error al actualizar el salario (¿vínculo válido?)." }
  }
}

/** Fija/corrige los datos de seguridad social de un funcionario (los necesita Nómina para PILA). */
export async function actualizarDatosSSAction(_prev: AccionState, formData: FormData): Promise<AccionState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "actos_administrativos"))) {
    return { ok: false, error: "No tienes la capacidad para actualizar datos de seguridad social." }
  }
  const usuarioId = String(formData.get("usuarioId") ?? "").trim()
  const codigoEps = String(formData.get("codigoEps") ?? "").trim() || null
  const codigoAfp = String(formData.get("codigoAfp") ?? "").trim() || null
  const codigoArl = String(formData.get("codigoArl") ?? "").trim() || null
  const codigoCaja = String(formData.get("codigoCaja") ?? "").trim() || null
  const claseRiesgoRaw = String(formData.get("claseRiesgoArl") ?? "").trim()
  const claseRiesgoArl = claseRiesgoRaw ? Number(claseRiesgoRaw) : null

  if (!usuarioId) return { ok: false, error: "Selecciona el funcionario." }
  if (claseRiesgoArl !== null && (!Number.isInteger(claseRiesgoArl) || claseRiesgoArl < 1 || claseRiesgoArl > 5)) {
    return { ok: false, error: "La clase de riesgo ARL debe ser un número entre 1 y 5." }
  }

  try {
    await ctx.db.usuario.update({ where: { id: usuarioId }, data: { codigoEps, codigoAfp, codigoArl, codigoCaja, claseRiesgoArl } })
    revalidatePath("/admin/rrhh")
    return { ok: true, mensaje: "Datos de seguridad social actualizados." }
  } catch {
    return { ok: false, error: "Error al actualizar (¿funcionario válido?)." }
  }
}

export async function registrarAusenciaAction(_prev: AccionState, formData: FormData): Promise<AccionState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "actos_administrativos"))) {
    return { ok: false, error: "No tienes la capacidad para registrar ausencias." }
  }
  const usuarioId = String(formData.get("usuarioId") ?? "").trim()
  const tipo = String(formData.get("tipo") ?? "").trim()
  const desdeRaw = String(formData.get("desde") ?? "").trim()
  const hastaRaw = String(formData.get("hasta") ?? "").trim()
  const motivo = String(formData.get("motivo") ?? "").trim() || null

  if (!usuarioId) return { ok: false, error: "Selecciona el funcionario." }
  if (!AUSENCIA_TIPOS.includes(tipo)) return { ok: false, error: "Tipo de ausencia inválido." }
  if (!desdeRaw || !hastaRaw) return { ok: false, error: "Las fechas \"desde\" y \"hasta\" son obligatorias." }
  const desde = new Date(desdeRaw)
  const hasta = new Date(hastaRaw)
  if (hasta < desde) return { ok: false, error: "La fecha \"hasta\" no puede ser anterior a \"desde\"." }

  try {
    await ctx.db.ausencia.create({ data: { usuarioId, tipo: tipo as never, desde, hasta, motivo } })
    revalidatePath("/admin/rrhh")
    return { ok: true, mensaje: "Ausencia registrada." }
  } catch {
    return { ok: false, error: "Error al registrar la ausencia (¿funcionario válido?)." }
  }
}

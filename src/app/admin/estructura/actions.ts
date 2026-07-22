"use server"

import { revalidatePath } from "next/cache"
import { requerirRolTenant } from "@/lib/dal-tenant"
import { aplicarPlantilla, hayPlantilla } from "@/lib/dominio/plantillas-cargo"

// Acciones de administración de la ESTRUCTURA ORGANIZACIONAL del tenant. Todas gateadas por
// rol de IDENTIDAD del tenant (ADMIN/SUPER_ADMIN) — administrar la estructura NO es una
// capacidad de módulo, es administración del tenant. Cada acción resuelve el tenant + su db
// desde el host (requerirRolTenant) y revalida la página.

const ADMINS = ["ADMIN", "SUPER_ADMIN"]
const DEP_TIPOS = ["DESPACHO", "SECRETARIA", "SUBSECRETARIA", "DIRECCION", "OFICINA"]
const VINC_TIPOS = ["TITULAR", "ENCARGADO", "PROVISIONAL"]
const ROLES = ["SUPER_ADMIN", "ADMIN", "USER", "CONTRATISTA"]

export interface AccionState {
  ok?: boolean
  error?: string
  mensaje?: string
}

/** Siembra la plantilla de estructura del TIPO de entidad del tenant (idempotente). */
export async function sembrarEstructuraAction(): Promise<AccionState> {
  const { tenant, db } = await requerirRolTenant(ADMINS)
  if (!hayPlantilla(tenant.tipoEntidad)) {
    return { ok: false, error: `No hay plantilla de estructura para el tipo "${tenant.tipoEntidad}".` }
  }
  try {
    const r = await aplicarPlantilla(db, tenant.tipoEntidad)
    revalidatePath("/admin/estructura")
    return { ok: true, mensaje: `Estructura sembrada: ${r.dependencias} dependencias, ${r.cargos} cargos nuevos.` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al sembrar la estructura." }
  }
}

export async function crearDependenciaAction(_prev: AccionState, formData: FormData): Promise<AccionState> {
  const { db } = await requerirRolTenant(ADMINS)
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase()
  const nombre = String(formData.get("nombre") ?? "").trim()
  const tipo = String(formData.get("tipo") ?? "").trim()
  const padreId = String(formData.get("padreId") ?? "").trim() || null
  const esServicioCompartido = formData.get("esServicioCompartido") === "on"

  if (!codigo || !nombre) return { ok: false, error: "Código y nombre son obligatorios." }
  if (!DEP_TIPOS.includes(tipo)) return { ok: false, error: "Tipo de dependencia inválido." }

  try {
    await db.dependencia.create({
      data: { codigo, nombre, tipo: tipo as never, padreId, esServicioCompartido },
    })
    revalidatePath("/admin/estructura")
    return { ok: true, mensaje: `Dependencia "${nombre}" creada.` }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique") ? `El código "${codigo}" ya existe.` : "Error al crear la dependencia."
    return { ok: false, error: msg }
  }
}

export async function crearCargoAction(_prev: AccionState, formData: FormData): Promise<AccionState> {
  const { db } = await requerirRolTenant(ADMINS)
  const dependenciaId = String(formData.get("dependenciaId") ?? "").trim()
  const nombre = String(formData.get("nombre") ?? "").trim()
  const esJefatura = formData.get("esJefatura") === "on"

  if (!dependenciaId || !nombre) return { ok: false, error: "Dependencia y nombre del cargo son obligatorios." }

  try {
    await db.cargo.create({ data: { dependenciaId, nombre, esJefatura, grants: {} } })
    revalidatePath("/admin/estructura")
    return { ok: true, mensaje: `Cargo "${nombre}" creado.` }
  } catch {
    return { ok: false, error: "Error al crear el cargo (¿dependencia válida?)." }
  }
}

export async function crearFuncionarioAction(_prev: AccionState, formData: FormData): Promise<AccionState> {
  const { db } = await requerirRolTenant(ADMINS)
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const nombre = String(formData.get("nombre") ?? "").trim()
  const apellido = String(formData.get("apellido") ?? "").trim()
  const rol = String(formData.get("rol") ?? "USER").trim()

  if (!email || !nombre || !apellido) return { ok: false, error: "Correo, nombre y apellido son obligatorios." }
  if (!ROLES.includes(rol)) return { ok: false, error: "Rol inválido." }

  try {
    await db.usuario.create({ data: { email, nombre, apellido, rol: rol as never } })
    revalidatePath("/admin/estructura")
    return { ok: true, mensaje: `Funcionario "${nombre} ${apellido}" creado. Fija su contraseña para darle acceso.` }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique") ? `El correo "${email}" ya está registrado.` : "Error al crear el funcionario."
    return { ok: false, error: msg }
  }
}

export async function crearVinculacionAction(_prev: AccionState, formData: FormData): Promise<AccionState> {
  const { db } = await requerirRolTenant(ADMINS)
  const usuarioId = String(formData.get("usuarioId") ?? "").trim()
  const cargoId = String(formData.get("cargoId") ?? "").trim()
  const tipo = String(formData.get("tipo") ?? "TITULAR").trim()
  const actoAdmin = String(formData.get("actoAdmin") ?? "").trim() || null

  if (!usuarioId || !cargoId) return { ok: false, error: "Funcionario y cargo son obligatorios." }
  if (!VINC_TIPOS.includes(tipo)) return { ok: false, error: "Tipo de vínculo inválido." }

  try {
    await db.vinculacionCargo.create({
      data: { usuarioId, cargoId, tipo: tipo as never, actoAdmin },
    })
    revalidatePath("/admin/estructura")
    return { ok: true, mensaje: "Vínculo persona↔cargo creado." }
  } catch {
    return { ok: false, error: "Error al crear el vínculo (¿funcionario y cargo válidos?)." }
  }
}

/** Asigna los MÓDULOS que maneja una dependencia (solo los disponibles para el tenant). */
export async function asignarModulosDependenciaAction(_prev: AccionState, formData: FormData): Promise<AccionState> {
  const { db, tenant } = await requerirRolTenant(ADMINS)
  const dependenciaId = String(formData.get("dependenciaId") ?? "").trim()
  if (!dependenciaId) return { ok: false, error: "Falta la dependencia." }

  const { moduloDisponible } = await import("@/lib/modulos")
  const modulos = formData.getAll("modulos").map(String).filter((m) => moduloDisponible(m, tenant.modulosContratados))

  try {
    await db.dependencia.update({ where: { id: dependenciaId }, data: { modulos } })
    revalidatePath("/admin/estructura")
    return { ok: true, mensaje: "Módulos de la dependencia actualizados." }
  } catch {
    return { ok: false, error: "Error al asignar módulos a la dependencia." }
  }
}

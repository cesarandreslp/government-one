"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

// SG-SST (Decreto 1072/2015). Gateado por capacidad `sst` (consultar/administrar). Simplificación
// legal declarada: registro interno, no genera FURAT/FUREL ni notifica a la ARL.

const MODULO = "sst"

export interface SstState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function registrarRiesgoAction(_prev: SstState, formData: FormData): Promise<SstState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar SST." }

  const cargoId = String(formData.get("cargoId") ?? "").trim()
  const peligro = String(formData.get("peligro") ?? "").trim()
  const riesgo = String(formData.get("riesgo") ?? "").trim()
  const nivelRiesgo = String(formData.get("nivelRiesgo") ?? "").trim()
  const medidasControl = String(formData.get("medidasControl") ?? "").trim() || null

  if (!cargoId || !peligro || !riesgo) return { ok: false, error: "Cargo, peligro y riesgo son obligatorios." }
  if (!["ACEPTABLE", "MEJORABLE", "NO_ACEPTABLE"].includes(nivelRiesgo)) return { ok: false, error: "Nivel de riesgo inválido." }

  try {
    await ctx.db.sstRiesgoCargo.create({ data: { cargoId, peligro, riesgo, nivelRiesgo: nivelRiesgo as never, medidasControl } })
    revalidatePath("/admin/sst")
    return { ok: true, mensaje: "Riesgo registrado en la matriz." }
  } catch {
    return { ok: false, error: "Error al registrar el riesgo." }
  }
}

export async function registrarIncidenteAction(_prev: SstState, formData: FormData): Promise<SstState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar SST." }

  const usuarioId = String(formData.get("usuarioId") ?? "").trim()
  const tipo = String(formData.get("tipo") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()
  const descripcion = String(formData.get("descripcion") ?? "").trim()
  const diasIncapacidad = formData.get("diasIncapacidad") ? Number(formData.get("diasIncapacidad")) : null
  const reportadoArl = formData.get("reportadoArl") === "on"

  if (!usuarioId || !tipo || !fecha || !descripcion) return { ok: false, error: "Todos los campos son obligatorios." }
  if (!["ACCIDENTE", "INCIDENTE", "ENFERMEDAD_LABORAL"].includes(tipo)) return { ok: false, error: "Tipo inválido." }

  try {
    await ctx.db.sstIncidente.create({
      data: { usuarioId, tipo: tipo as never, fecha: new Date(fecha), descripcion, diasIncapacidad, reportadoArl, creadoPor: ctx.sesion.usuarioId },
    })
    revalidatePath("/admin/sst")
    return { ok: true, mensaje: "Registrado en accidentalidad." }
  } catch {
    return { ok: false, error: "Error al registrar." }
  }
}

export async function registrarExamenAction(_prev: SstState, formData: FormData): Promise<SstState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar SST." }

  const usuarioId = String(formData.get("usuarioId") ?? "").trim()
  const tipo = String(formData.get("tipo") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()
  const resultado = String(formData.get("resultado") ?? "").trim()
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null

  if (!usuarioId || !tipo || !fecha || !resultado) return { ok: false, error: "Todos los campos son obligatorios." }
  if (!["INGRESO", "PERIODICO", "RETIRO"].includes(tipo)) return { ok: false, error: "Tipo de examen inválido." }
  if (!["APTO", "APTO_CON_RESTRICCIONES", "NO_APTO"].includes(resultado)) return { ok: false, error: "Resultado inválido." }

  try {
    await ctx.db.sstExamenMedico.create({
      data: { usuarioId, tipo: tipo as never, fecha: new Date(fecha), resultado: resultado as never, observaciones, creadoPor: ctx.sesion.usuarioId },
    })
    revalidatePath("/admin/sst")
    return { ok: true, mensaje: "Examen médico registrado." }
  } catch {
    return { ok: false, error: "Error al registrar el examen." }
  }
}

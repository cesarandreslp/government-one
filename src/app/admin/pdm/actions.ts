"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

// Plan de Desarrollo Municipal (Ley 152/1994): Periodo→Eje→Programa→Meta, gateado por capacidad
// `pdm` (administrar = estructura; reportar_avance = seguimiento). El seguimiento es MANUAL por
// vigencia — cuando una meta tiene proyectos de Banco de Proyectos enlazados, su avance físico se
// muestra como referencia en la UI, pero no se suma automáticamente (unidades incompatibles entre
// proyectos distintos que aportan a la misma meta).

const MODULO = "pdm"
const TIPOS_META = ["PRODUCTO", "RESULTADO"]

export interface PdmState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function crearPeriodoAction(_prev: PdmState, formData: FormData): Promise<PdmState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar el PDM." }

  const nombre = String(formData.get("nombre") ?? "").trim()
  const vigenciaInicio = Number(formData.get("vigenciaInicio"))
  const vigenciaFin = Number(formData.get("vigenciaFin"))

  if (!nombre) return { ok: false, error: "El nombre es obligatorio." }
  if (!Number.isFinite(vigenciaInicio) || !Number.isFinite(vigenciaFin) || vigenciaFin < vigenciaInicio) {
    return { ok: false, error: "Vigencia inválida." }
  }

  try {
    await ctx.db.pdmPeriodo.create({ data: { nombre, vigenciaInicio, vigenciaFin } })
    revalidatePath("/admin/pdm")
    return { ok: true, mensaje: `"${nombre}" creado.` }
  } catch {
    return { ok: false, error: "Error al crear el periodo del PDM." }
  }
}

export async function crearEjeAction(_prev: PdmState, formData: FormData): Promise<PdmState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar el PDM." }

  const periodoId = String(formData.get("periodoId") ?? "").trim()
  const nombre = String(formData.get("nombre") ?? "").trim()
  if (!periodoId || !nombre) return { ok: false, error: "Periodo y nombre del eje son obligatorios." }

  try {
    await ctx.db.pdmEje.create({ data: { periodoId, nombre } })
    revalidatePath("/admin/pdm")
    return { ok: true, mensaje: `Eje "${nombre}" creado.` }
  } catch {
    return { ok: false, error: "Error al crear el eje." }
  }
}

export async function crearProgramaAction(_prev: PdmState, formData: FormData): Promise<PdmState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar el PDM." }

  const ejeId = String(formData.get("ejeId") ?? "").trim()
  const nombre = String(formData.get("nombre") ?? "").trim()
  const dependenciaId = String(formData.get("dependenciaId") ?? "").trim() || null
  if (!ejeId || !nombre) return { ok: false, error: "Eje y nombre del programa son obligatorios." }

  try {
    await ctx.db.pdmPrograma.create({ data: { ejeId, nombre, dependenciaId } })
    revalidatePath("/admin/pdm")
    return { ok: true, mensaje: `Programa "${nombre}" creado.` }
  } catch {
    return { ok: false, error: "Error al crear el programa." }
  }
}

export async function crearMetaAction(_prev: PdmState, formData: FormData): Promise<PdmState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar el PDM." }

  const programaId = String(formData.get("programaId") ?? "").trim()
  const tipo = String(formData.get("tipo") ?? "").trim()
  const indicador = String(formData.get("indicador") ?? "").trim()
  const unidadMedida = String(formData.get("unidadMedida") ?? "").trim()
  const lineaBase = Number(formData.get("lineaBase"))
  const metaCuatrienio = Number(formData.get("metaCuatrienio"))

  if (!programaId || !indicador || !unidadMedida) return { ok: false, error: "Programa, indicador y unidad de medida son obligatorios." }
  if (!TIPOS_META.includes(tipo)) return { ok: false, error: "Tipo de meta inválido." }
  if (!Number.isFinite(lineaBase) || lineaBase < 0) return { ok: false, error: "La línea base debe ser ≥ 0." }
  if (!Number.isFinite(metaCuatrienio) || metaCuatrienio <= 0) return { ok: false, error: "La meta del cuatrienio debe ser mayor a 0." }

  try {
    await ctx.db.pdmMeta.create({ data: { programaId, tipo: tipo as never, indicador, unidadMedida, lineaBase, metaCuatrienio } })
    revalidatePath("/admin/pdm")
    return { ok: true, mensaje: `Meta "${indicador}" creada.` }
  } catch {
    return { ok: false, error: "Error al crear la meta." }
  }
}

export async function reportarSeguimientoAction(_prev: PdmState, formData: FormData): Promise<PdmState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "reportar_avance"))) return { ok: false, error: "No tienes la capacidad para reportar avance del PDM." }

  const metaId = String(formData.get("metaId") ?? "").trim()
  const vigencia = Number(formData.get("vigencia"))
  const valorAcumulado = Number(formData.get("valorAcumulado"))
  const observacion = String(formData.get("observacion") ?? "").trim() || null

  if (!metaId) return { ok: false, error: "Selecciona una meta." }
  if (!Number.isFinite(vigencia)) return { ok: false, error: "Vigencia inválida." }
  if (!Number.isFinite(valorAcumulado) || valorAcumulado < 0) return { ok: false, error: "El valor acumulado debe ser ≥ 0." }

  const meta = await ctx.db.pdmMeta.findUnique({ where: { id: metaId } })
  if (!meta) return { ok: false, error: "Meta no encontrada." }

  try {
    await ctx.db.pdmMetaSeguimiento.create({ data: { metaId, vigencia, valorAcumulado, observacion, reportadoPor: ctx.sesion.usuarioId } })
    revalidatePath("/admin/pdm")
    return { ok: true, mensaje: `Seguimiento ${vigencia} de "${meta.indicador}" registrado: ${valorAcumulado} ${meta.unidadMedida}.` }
  } catch {
    return { ok: false, error: "Error al registrar el seguimiento." }
  }
}

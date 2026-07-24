"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

// Gestión Disciplinaria (Ley 1952/2019, CGD). Gateada por capacidad `gestion_disciplinaria`
// (consultar/gestionar) — según el comparativo, esta capacidad suele vivir en Jurídica, no en
// Talento Humano (ver plantillas-cargo.ts). Historial insert-only de actuaciones, mismo patrón
// que CoactivoActuacion. Simplificación legal declarada: registro administrativo del trámite
// interno, no un sistema de notificación judicial con efectos procesales garantizados.

const MODULO = "gestion_disciplinaria"
const ESTADOS = ["INDAGACION_PRELIMINAR", "INVESTIGACION", "DESCARGOS", "FALLO", "ARCHIVADO"]

export interface DiscState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function abrirProcesoAction(_prev: DiscState, formData: FormData): Promise<DiscState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "gestionar"))) return { ok: false, error: "No tienes la capacidad para gestionar procesos disciplinarios." }

  const usuarioId = String(formData.get("usuarioId") ?? "").trim()
  const motivo = String(formData.get("motivo") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()

  if (!usuarioId || !motivo || !fecha) return { ok: false, error: "Todos los campos son obligatorios." }

  const anio = new Date(fecha).getUTCFullYear()

  try {
    const proceso = await ctx.db.$transaction(async (tx) => {
      const cons = await tx.disciplinarioConsecutivo.upsert({
        where: { anio }, create: { anio, ultimo: 1 }, update: { ultimo: { increment: 1 } },
      })
      const numero = `DISC-${anio}-${String(cons.ultimo).padStart(6, "0")}`
      return tx.procesoDisciplinario.create({
        data: {
          numero, usuarioId, motivo, fechaApertura: new Date(fecha), creadoPor: ctx.sesion.usuarioId,
          actuaciones: { create: [{ fecha: new Date(fecha), descripcion: `Apertura de indagación preliminar. Motivo: ${motivo}`, registradoPor: ctx.sesion.usuarioId }] },
        },
      })
    })
    revalidatePath("/admin/disciplinario")
    return { ok: true, mensaje: `${proceso.numero} abierto.` }
  } catch {
    return { ok: false, error: "Error al abrir el proceso." }
  }
}

export async function registrarActuacionAction(_prev: DiscState, formData: FormData): Promise<DiscState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "gestionar"))) return { ok: false, error: "No tienes la capacidad para gestionar procesos disciplinarios." }

  const procesoId = String(formData.get("procesoId") ?? "").trim()
  const estado = String(formData.get("estado") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()
  const descripcion = String(formData.get("descripcion") ?? "").trim()

  if (!procesoId || !estado || !fecha || !descripcion) return { ok: false, error: "Todos los campos son obligatorios." }
  if (!ESTADOS.includes(estado)) return { ok: false, error: "Estado inválido." }

  const proceso = await ctx.db.procesoDisciplinario.findUnique({ where: { id: procesoId } })
  if (!proceso) return { ok: false, error: "Proceso no encontrado." }
  if (proceso.estado === "ARCHIVADO") return { ok: false, error: "Este proceso ya está ARCHIVADO." }

  try {
    await ctx.db.$transaction(async (tx) => {
      await tx.disciplinarioActuacion.create({ data: { procesoId, fecha: new Date(fecha), descripcion, registradoPor: ctx.sesion.usuarioId } })
      await tx.procesoDisciplinario.update({
        where: { id: procesoId },
        data: {
          estado: estado as never,
          ...(estado === "FALLO" ? { decision: descripcion, fechaFallo: new Date(fecha) } : {}),
        },
      })
    })
    revalidatePath("/admin/disciplinario")
    return { ok: true, mensaje: "Actuación registrada." }
  } catch {
    return { ok: false, error: "Error al registrar la actuación." }
  }
}

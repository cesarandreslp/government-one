import "server-only"
import type { PrismaClient } from "@/generated/tenant/client"
import { resolverAsignacionVu } from "@/lib/vu-ruteo"
import { sumarDiasHabiles } from "@/lib/dias-habiles"

// Creación de PQRSD compartida entre el radicado interno (admin) y el formulario público del
// portal. Numera con consecutivo atómico por tenant/año, calcula el término de ley y AUTO-ASIGNA
// por ruteo de cargo (resolverAsignacionVu → quienEjerce).

export const PQRSD_TIPOS = ["PETICION", "QUEJA", "RECLAMO", "SUGERENCIA", "DENUNCIA"] as const
export const PQRSD_CANALES = ["WEB", "PRESENCIAL", "TELEFONICO", "EMAIL", "ESCRITO"] as const

// Término de ley en días hábiles por tipo (simplificado; info/consulta se afinan luego).
const TERMINO_DIAS: Record<string, number> = {
  PETICION: 15, QUEJA: 15, RECLAMO: 15, SUGERENCIA: 15, DENUNCIA: 15,
}

export interface CrearPqrsdInput {
  tipo: string
  canal: string
  peticionarioNombre: string
  peticionarioEmail?: string | null
  peticionarioTelefono?: string | null
  asunto: string
  descripcion: string
  dependenciaId?: string | null
}

export async function crearPqrsd(db: PrismaClient, input: CrearPqrsdInput) {
  const anio = new Date().getFullYear()
  const diasTermino = TERMINO_DIAS[input.tipo] ?? 15
  const fechaRecepcion = new Date()
  const fechaVencimiento = sumarDiasHabiles(fechaRecepcion, diasTermino)

  // Ruteo por cargo: resuelve el funcionario que EJERCE el cargo competente hoy.
  const asignacion = await resolverAsignacionVu(db, input.dependenciaId ?? null)

  return db.$transaction(async (tx) => {
    const cons = await tx.pqrsdConsecutivo.upsert({
      where: { anio },
      create: { anio, ultimo: 1 },
      update: { ultimo: { increment: 1 } },
    })
    const numero = `PQRSD-${anio}-${String(cons.ultimo).padStart(6, "0")}`
    return tx.pqrsd.create({
      data: {
        numero,
        anio,
        consecutivo: cons.ultimo,
        tipo: input.tipo as never,
        canal: input.canal as never,
        estado: asignacion?.usuarioId ? "ASIGNADA" : "RECIBIDA",
        peticionarioNombre: input.peticionarioNombre,
        peticionarioEmail: input.peticionarioEmail ?? null,
        peticionarioTelefono: input.peticionarioTelefono ?? null,
        asunto: input.asunto,
        descripcion: input.descripcion,
        dependenciaId: asignacion?.dependenciaId ?? input.dependenciaId ?? null,
        cargoAsignadoId: asignacion?.cargoId ?? null,
        usuarioAsignadoId: asignacion?.usuarioId ?? null,
        diasTermino,
        fechaRecepcion,
        fechaVencimiento,
      },
    })
  })
}

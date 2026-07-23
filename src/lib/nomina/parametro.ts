import type { PrismaClient } from "@/generated/tenant/client"

// Parámetros de nómina (singleton por tenant). El UVT lo publica la DIAN cada año (Resolución de
// diciembre) — se siembra con el valor 2025 conocido ($49.799, Resolución DIAN 000193 de 2024)
// como referencia inicial; el tenant lo actualiza cuando la DIAN publique el del año en curso.
// Sembrar un valor real y fechado (con su fuente) es más honesto que un placeholder inventado.

const UVT_REFERENCIA = 49799 // UVT 2025 (Resolución DIAN 000193 del 2024-11-21)

export type ParametroDB = Pick<PrismaClient, "nominaParametro">

/** Lee el UVT vigente del tenant; lo siembra con el valor de referencia si no existe aún. */
export async function obtenerUvt(db: ParametroDB): Promise<number> {
  const p = await db.nominaParametro.findFirst()
  if (p) return Number(p.uvt)
  const creado = await db.nominaParametro.create({ data: { uvt: UVT_REFERENCIA } })
  return Number(creado.uvt)
}

/** Fija el UVT vigente (lo debe actualizar el tenant cada año cuando la DIAN publique el nuevo). */
export async function fijarUvt(db: ParametroDB, uvt: number): Promise<void> {
  const p = await db.nominaParametro.findFirst()
  if (p) {
    await db.nominaParametro.update({ where: { id: p.id }, data: { uvt } })
  } else {
    await db.nominaParametro.create({ data: { uvt } })
  }
}

import type { PrismaClient } from "@/generated/tenant/client"

// ejecucion.ts — el diferenciador del Banco de Proyectos (portado de personeriabuga, mismo
// patrón de fórmulas). Calcula, para un Proyecto, dos medidas INDEPENDIENTES:
//  - Ejecución FINANCIERA: % pagado sobre el valorTotal (o comprometido si no hay valorTotal),
//    derivada de la cadena presupuestal Cdp → Rp → Obligacion → Pago (solo documentos VIGENTE).
//  - Ejecución FÍSICA: % de avance real en campo, por hitos ponderados (ProyectoHito),
//    reportado por el supervisor — NO depende del dinero.
// La BRECHA (financiera% − física%) es la señal de riesgo: un anticipo pagado sin obra
// ejecutada da una brecha alta (ej. 50% pagado / 0% en campo).

type Db = Pick<PrismaClient, "cdp" | "proyectoHito">

export interface EjecucionFinanciera {
  comprometido: number // Σ CDP vigentes
  obligado: number // Σ Obligación vigentes
  pagado: number // Σ Pago vigentes
  porcentaje: number // pagado / max(valorTotal, comprometido), 0 si no hay base
}

export interface EjecucionFisica {
  pesoTotal: number // Σ pesoPorcentual de los hitos (tiende a 100, no se fuerza)
  porcentaje: number // ponderado, normalizado contra max(pesoTotal, 100)
  totalHitos: number
  hitosCompletos: number // avance >= 100
}

export interface EjecucionProyecto {
  financiera: EjecucionFinanciera
  fisica: EjecucionFisica
  brecha: number // financiera% − física%; positiva = se pagó más de lo ejecutado
  riesgo: "BAJO" | "MEDIO" | "ALTO"
}

function riesgoDeBrecha(brecha: number): "BAJO" | "MEDIO" | "ALTO" {
  if (brecha >= 40) return "ALTO"
  if (brecha >= 15) return "MEDIO"
  return "BAJO"
}

export async function ejecucionFinancieraProyecto(db: Db, proyectoId: string, valorTotal: number | null): Promise<EjecucionFinanciera> {
  const cdps = await db.cdp.findMany({
    where: { proyectoId, estado: "VIGENTE" },
    select: {
      valor: true,
      rps: {
        where: { estado: "VIGENTE" },
        select: {
          obligaciones: {
            where: { estado: "VIGENTE" },
            select: { valor: true, pagos: { where: { estado: "VIGENTE" }, select: { valor: true } } },
          },
        },
      },
    },
  })

  let comprometido = 0
  let obligado = 0
  let pagado = 0
  for (const cdp of cdps) {
    comprometido += Number(cdp.valor)
    for (const rp of cdp.rps) {
      for (const ob of rp.obligaciones) {
        obligado += Number(ob.valor)
        for (const p of ob.pagos) pagado += Number(p.valor)
      }
    }
  }

  const base = valorTotal && valorTotal > 0 ? valorTotal : comprometido
  const porcentaje = base > 0 ? Math.min(100, Math.round((pagado / base) * 10000) / 100) : 0

  return { comprometido, obligado, pagado, porcentaje }
}

export async function ejecucionFisicaProyecto(db: Db, proyectoId: string): Promise<EjecucionFisica> {
  const hitos = await db.proyectoHito.findMany({ where: { proyectoId }, select: { pesoPorcentual: true, avancePorcentual: true } })

  const pesoTotal = hitos.reduce((s, h) => s + Number(h.pesoPorcentual), 0)
  const avancePonderado = hitos.reduce((s, h) => s + (Number(h.pesoPorcentual) * Number(h.avancePorcentual)) / 100, 0)
  const base = Math.max(pesoTotal, 100)
  const porcentaje = base > 0 ? Math.min(100, Math.round((avancePonderado / base) * 10000) / 100) : 0
  const hitosCompletos = hitos.filter((h) => Number(h.avancePorcentual) >= 100).length

  return { pesoTotal, porcentaje, totalHitos: hitos.length, hitosCompletos }
}

export async function ejecucionProyecto(db: Db, proyectoId: string, valorTotal: number | null): Promise<EjecucionProyecto> {
  const [financiera, fisica] = await Promise.all([
    ejecucionFinancieraProyecto(db, proyectoId, valorTotal),
    ejecucionFisicaProyecto(db, proyectoId),
  ])
  const brecha = Math.round((financiera.porcentaje - fisica.porcentaje) * 100) / 100
  return { financiera, fisica, brecha, riesgo: riesgoDeBrecha(brecha) }
}

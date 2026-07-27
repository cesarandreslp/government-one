import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { ejecucionProyecto } from "@/lib/proyectos/ejecucion"
import { PdmAcciones } from "./pdm-acciones"

export const dynamic = "force-dynamic"

const TIPO_ETIQUETA: Record<string, string> = { PRODUCTO: "Producto", RESULTADO: "Resultado" }

export default async function PdmPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeAdministrar, puedeReportarAvance] = await Promise.all([
    funcionarioPuede(ctx, "pdm", "consultar"),
    funcionarioPuede(ctx, "pdm", "administrar"),
    funcionarioPuede(ctx, "pdm", "reportar_avance"),
  ])
  const sinAcceso = !puedeConsultar && !puedeAdministrar && !puedeReportarAvance
  if (sinAcceso) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Plan de Desarrollo Municipal</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">pdm</span>.
        </p>
      </main>
    )
  }

  const [periodos, dependencias] = await Promise.all([
    db.pdmPeriodo.findMany({
      orderBy: { vigenciaInicio: "desc" },
      include: {
        ejes: {
          orderBy: { orden: "asc" },
          include: {
            programas: {
              include: {
                dependencia: true,
                metas: {
                  include: {
                    seguimientos: { orderBy: { vigencia: "desc" }, take: 1 },
                    proyectos: { select: { id: true, codigo: true, nombre: true, valorTotal: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.dependencia.findMany({ where: { activa: true }, orderBy: { codigo: "asc" } }),
  ])

  const ejesOpciones = periodos.flatMap((p) => p.ejes.map((e) => ({ id: e.id, etiqueta: `${p.nombre} · ${e.nombre}` })))
  const programasOpciones = periodos.flatMap((p) => p.ejes.flatMap((e) => e.programas.map((pr) => ({ id: pr.id, etiqueta: `${e.nombre} · ${pr.nombre}` }))))
  const metasOpciones = periodos.flatMap((p) => p.ejes.flatMap((e) => e.programas.flatMap((pr) => pr.metas.map((m) => ({ id: m.id, etiqueta: `${pr.nombre} · ${m.indicador}` })))))

  const totalMetas = metasOpciones.length

  // Un programa puede depender de VARIAS secretarías: distintos proyectos (de distintas
  // dependencias) pueden apuntar a metas del mismo programa. Se agrega, por programa, la lista
  // ÚNICA de proyectos contribuyentes (across todas sus metas) con su secretaría responsable,
  // contribución (física/financiera, ver ejecucion.ts) y los contratos reales que lo financian
  // (Proyecto → Cdp → Rp → Contrato → Tercero=contratista — misma cadena que ejecucionFinanciera).
  const proyectoIds = [...new Set(
    periodos.flatMap((p) => p.ejes.flatMap((e) => e.programas.flatMap((pr) => pr.metas.flatMap((m) => m.proyectos.map((py) => py.id))))),
  )]
  const proyectosDetalle = await db.proyecto.findMany({
    where: { id: { in: proyectoIds } },
    include: {
      dependencia: true,
      cdps: { include: { rps: { include: { contratos: { include: { tercero: true } } } } } },
    },
  })
  const detallePorProyecto = new Map<string, (typeof proyectosDetalle)[number]>()
  const ejecucionPorProyecto = new Map<string, Awaited<ReturnType<typeof ejecucionProyecto>>>()
  for (const py of proyectosDetalle) {
    detallePorProyecto.set(py.id, py)
    ejecucionPorProyecto.set(py.id, await ejecucionProyecto(db, py.id, py.valorTotal ? Number(py.valorTotal) : null))
  }
  const fisicaPorProyecto = new Map(proyectosDetalle.map((py) => [py.id, ejecucionPorProyecto.get(py.id)!.fisica.porcentaje]))

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Plan de Desarrollo Municipal</h1>
        <p className="text-sm text-slate-500">{periodos.length} plan(es) · {totalMetas} meta(s).</p>
        <p className="mt-1 text-xs text-slate-400">
          Ejes→programas→metas (Ley 152/1994). El avance de cada meta se reporta manualmente por vigencia; si tiene
          proyectos del Banco de Proyectos vinculados, su avance físico se muestra como referencia (no se suma —
          unidades distintas por proyecto).
        </p>
      </header>

      {sinAcceso === false && (puedeAdministrar || puedeReportarAvance) && (
        <PdmAcciones
          puedeAdministrar={puedeAdministrar}
          puedeReportarAvance={puedeReportarAvance}
          periodos={periodos.map((p) => ({ id: p.id, etiqueta: `${p.nombre} (${p.vigenciaInicio}-${p.vigenciaFin})` }))}
          ejes={ejesOpciones}
          programas={programasOpciones}
          dependencias={dependencias.map((d) => ({ id: d.id, etiqueta: `${d.codigo} · ${d.nombre}` }))}
          metas={metasOpciones}
        />
      )}

      <section className="mt-8 grid gap-4">
        {periodos.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay un Plan de Desarrollo registrado.</p>
        )}
        {periodos.map((periodo) => (
          <div key={periodo.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-800">{periodo.nombre} <span className="text-xs font-normal text-slate-400">({periodo.vigenciaInicio}-{periodo.vigenciaFin})</span></h2>
            <div className="mt-3 space-y-4">
              {periodo.ejes.length === 0 && <p className="text-sm text-slate-400">Sin ejes aún.</p>}
              {periodo.ejes.map((eje) => (
                <div key={eje.id} className="border-l-2 border-indigo-200 pl-4">
                  <h3 className="text-sm font-semibold text-indigo-700">{eje.nombre}</h3>
                  {eje.programas.map((programa) => {
                    const proyectosPrograma = [...new Map(
                      programa.metas.flatMap((m) => m.proyectos).map((py) => [py.id, py]),
                    ).values()]
                    return (
                    <div key={programa.id} className="mt-2 border-l-2 border-slate-100 pl-4">
                      <div className="text-sm font-medium text-slate-700">
                        {programa.nombre}
                        {programa.dependencia && <span className="ml-2 text-xs text-slate-400">{programa.dependencia.codigo} (líder)</span>}
                      </div>
                      {programa.metas.length === 0 ? (
                        <p className="text-xs text-slate-400">Sin metas aún.</p>
                      ) : (
                        <ul className="mt-1 space-y-2">
                          {programa.metas.map((meta) => {
                            const ultimo = meta.seguimientos[0]
                            const avance = ultimo ? Math.min(100, Math.round((Number(ultimo.valorAcumulado) / Number(meta.metaCuatrienio)) * 10000) / 100) : null
                            return (
                              <li key={meta.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-slate-700">
                                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{TIPO_ETIQUETA[meta.tipo]}</span>
                                    {" "}{meta.indicador}
                                  </span>
                                  <span className="font-mono text-slate-500">
                                    {ultimo ? `${Number(ultimo.valorAcumulado)} / ${Number(meta.metaCuatrienio)} ${meta.unidadMedida} (${avance}%)` : `meta: ${Number(meta.metaCuatrienio)} ${meta.unidadMedida} — sin seguimiento`}
                                  </span>
                                </div>
                                {meta.proyectos.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-indigo-500">
                                    {meta.proyectos.map((py) => (
                                      <span key={py.id}>← {py.codigo} ({fisicaPorProyecto.get(py.id) ?? 0}% físico)</span>
                                    ))}
                                  </div>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}

                      {proyectosPrograma.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Proyectos y contratos (todas las secretarías)</p>
                          <ul className="mt-1 space-y-2">
                            {proyectosPrograma.map((py) => {
                              const detalle = detallePorProyecto.get(py.id)
                              const ej = ejecucionPorProyecto.get(py.id)
                              const contratos = detalle?.cdps.flatMap((cdp) => cdp.rps.flatMap((rp) => rp.contratos)) ?? []
                              return (
                                <li key={py.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-slate-700">
                                      <span className="font-mono text-slate-500">{py.codigo}</span> {py.nombre}
                                      {detalle && <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">{detalle.dependencia.codigo}</span>}
                                    </span>
                                    {ej && (
                                      <span className="font-mono text-slate-500">
                                        financiera {ej.financiera.porcentaje}% · física {ej.fisica.porcentaje}%
                                      </span>
                                    )}
                                  </div>
                                  {contratos.length === 0 ? (
                                    <p className="mt-1 text-slate-400">Sin contratos asociados aún.</p>
                                  ) : (
                                    <ul className="mt-1 space-y-0.5">
                                      {contratos.map((c) => (
                                        <li key={c.id} className="text-slate-500">
                                          <span className="font-mono">{c.numero}</span> · contratista: {c.tercero.razonSocial} ({c.tercero.documento}) · ${Number(c.valorContrato).toLocaleString()} · {c.estado}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}

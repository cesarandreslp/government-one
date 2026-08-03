import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

export const dynamic = "force-dynamic"

export default async function CertificadoJacPage({
  searchParams,
}: {
  searchParams: Promise<{ jacId?: string }>
}) {
  const { jacId } = await searchParams
  const ctx = await requerirFuncionario()
  const { db, tenant } = ctx

  if (!(await funcionarioPuede(ctx, "participacion_ciudadana", "consultar"))) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidad de Participación Ciudadana para consultar certificados.
        </p>
      </main>
    )
  }

  if (!jacId) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-slate-500">Falta la JAC. Vuelve a Participación Ciudadana y usa el enlace "Certificado".</p>
      </main>
    )
  }

  const jac = await db.jac.findUnique({
    where: { id: jacId },
    include: { dignatarios: { include: { persona: true }, orderBy: { periodoInicio: "desc" } } },
  })
  if (!jac) {
    return <main className="mx-auto max-w-2xl px-6 py-10"><p className="text-sm text-red-600">JAC no encontrada.</p></main>
  }

  const hoy = new Date()
  const vigentes = jac.dignatarios.filter((d) => d.periodoInicio <= hoy && d.periodoFin >= hoy)
  const numeroCertificado = `JAC-${jac.id.slice(-6).toUpperCase()}-${hoy.getUTCFullYear()}`

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 print:py-0">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <header className="mb-6 border-b border-slate-200 pb-4 text-center">
          <h1 className="text-lg font-semibold text-slate-800">{tenant.nombre}</h1>
          <p className="text-sm text-slate-500">Certificado de Existencia y Representación — Junta de Acción Comunal</p>
          <p className="text-xs text-slate-400">N.° {numeroCertificado} · Expedido {hoy.toISOString().slice(0, 10)}</p>
        </header>

        <p className="mb-6 text-sm leading-relaxed text-slate-700">
          La Secretaría de Gobierno de <strong>{tenant.nombre}</strong> certifica que la organización comunal{" "}
          <strong>{jac.nombre}</strong>, del barrio/vereda <strong>{jac.barrioVereda}</strong>
          {jac.personeriaJuridica && <> (personería jurídica N.° <strong>{jac.personeriaJuridica}</strong>)</>}, se
          encuentra <strong>{jac.estado}</strong> en el registro de organismos comunales, según lo establecido en la
          Ley 743/2002.
        </p>

        <section className="rounded-lg bg-slate-50 p-4 text-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Dignatarios vigentes</p>
          {vigentes.length === 0 ? (
            <p className="text-slate-400">Sin dignatarios vigentes registrados.</p>
          ) : (
            <ul className="space-y-1">
              {vigentes.map((d) => (
                <li key={d.id} className="flex justify-between">
                  <span className="text-slate-600">{d.cargo}</span>
                  <span className="font-medium text-slate-800">{d.persona.razonSocial} ({d.persona.documento})</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-8 text-xs text-slate-400">
          Este certificado se genera a partir del registro local de la Secretaría de Gobierno — no reemplaza el
          registro nacional de personas jurídicas cuando aplique.
        </p>
      </div>
    </main>
  )
}

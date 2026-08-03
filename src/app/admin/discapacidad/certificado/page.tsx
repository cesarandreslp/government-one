import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

export const dynamic = "force-dynamic"

export default async function CertificadoDiscapacidadPage({
  searchParams,
}: {
  searchParams: Promise<{ registroId?: string }>
}) {
  const { registroId } = await searchParams
  const ctx = await requerirFuncionario()
  const { db, tenant } = ctx

  if (!(await funcionarioPuede(ctx, "discapacidad", "consultar"))) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidad de Discapacidad para consultar certificados.
        </p>
      </main>
    )
  }

  if (!registroId) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-slate-500">Falta el registro. Vuelve a Discapacidad y usa el enlace "Certificado".</p>
      </main>
    )
  }

  const registro = await db.registroDiscapacidad.findUnique({ where: { id: registroId }, include: { persona: true } })
  if (!registro) {
    return <main className="mx-auto max-w-2xl px-6 py-10"><p className="text-sm text-red-600">Registro no encontrado.</p></main>
  }

  const hoy = new Date()
  const numeroCertificado = `DISC-${registro.id.slice(-6).toUpperCase()}-${hoy.getUTCFullYear()}`

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 print:py-0">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <header className="mb-6 border-b border-slate-200 pb-4 text-center">
          <h1 className="text-lg font-semibold text-slate-800">{tenant.nombre}</h1>
          <p className="text-sm text-slate-500">Certificado de Registro de Discapacidad</p>
          <p className="text-xs text-slate-400">N.° {numeroCertificado} · Expedido {hoy.toISOString().slice(0, 10)}</p>
        </header>

        <p className="mb-6 text-sm leading-relaxed text-slate-700">
          La Secretaría de Bienestar Social de <strong>{tenant.nombre}</strong> certifica que{" "}
          <strong>{registro.persona.razonSocial}</strong>, identificado(a) con documento{" "}
          <strong>{registro.persona.documento}</strong>, se encuentra registrado(a) con discapacidad tipo{" "}
          <strong>{registro.tipo}</strong> en el registro local de caracterización, {registro.vigente ? "VIGENTE" : "NO VIGENTE"}.
        </p>

        <section className="rounded-lg bg-slate-50 p-4 text-sm">
          <div className="flex justify-between"><span className="text-slate-600">Tipo de discapacidad</span><span className="font-semibold text-slate-800">{registro.tipo}</span></div>
          <div className="mt-1 flex justify-between"><span className="text-slate-600">Fecha de registro</span><span className="font-mono text-slate-700">{registro.fechaRegistro.toISOString().slice(0, 10)}</span></div>
        </section>

        <p className="mt-8 text-xs text-slate-400">
          Este certificado se genera a partir del registro local de la Secretaría de Bienestar Social — no
          reemplaza el Registro de Localización y Caracterización de Personas con Discapacidad (RLCPD) nacional.
        </p>
      </div>
    </main>
  )
}

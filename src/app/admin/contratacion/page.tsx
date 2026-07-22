import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { usuariosConCapacidad } from "@/lib/dominio/acceso"
import { ContratacionAcciones } from "./contratacion-acciones"

export const dynamic = "force-dynamic"

export default async function ContratacionPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeElaborar, puedeRevisarJuridica, puedeConceptoJuridico, puedeAprobar, puedeSupervisar] = await Promise.all([
    funcionarioPuede(ctx, "contratacion", "elaborar"),
    funcionarioPuede(ctx, "contratacion", "revisar_juridica"),
    funcionarioPuede(ctx, "contratacion", "concepto_juridico"),
    funcionarioPuede(ctx, "contratacion", "aprobar"),
    funcionarioPuede(ctx, "contratacion", "supervisar"),
  ])

  const [contratos, terceros, rpsDisponibles, estructuradores, abogados] = await Promise.all([
    db.contrato.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        tercero: true, estructurador: true, abogadoAsignado: true,
        versiones: { orderBy: { numeroVersion: "desc" } },
        rp: { include: { cdp: { include: { proyecto: true } } } },
      },
    }),
    db.tercero.findMany({ orderBy: { razonSocial: "asc" } }),
    // RP vigentes que aún no respaldan otro contrato — un RP no se reparte entre contratos.
    db.rp.findMany({ where: { estado: "VIGENTE", contratos: { none: {} } }, orderBy: { numero: "asc" } }),
    usuariosConCapacidad(db, "contratacion", "elaborar"),
    usuariosConCapacidad(db, "contratacion", "revisar_juridica"),
  ])

  const sinAcceso = !puedeElaborar && !puedeRevisarJuridica && !puedeConceptoJuridico && !puedeAprobar && !puedeSupervisar
  const valorTotal = contratos.reduce((s, c) => s + Number(c.valorContrato), 0)
  const enEjecucion = contratos.filter((c) => c.estado === "EN_EJECUCION").length

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Contratación</h1>
        <p className="text-sm text-slate-500">
          Ley 80/1150 — estructuración → revisión jurídica → suscripción → ejecución, con gating real por persona asignada.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{contratos.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Contratos</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{enEjecucion}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">En ejecución</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
          <div className="text-2xl font-semibold text-slate-800">${valorTotal.toLocaleString()}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Valor total contratado</div>
        </div>
      </div>

      {sinAcceso && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidades de Contratación. Pídele a un administrador que te asigne un cargo con
          <span className="font-mono"> contratacion</span> (elaborar / revisar_juridica / concepto_juridico / supervisar / aprobar).
        </div>
      )}

      <ContratacionAcciones
        usuarioId={ctx.sesion.usuarioId}
        esAdmin={ctx.sesion.rol === "ADMIN" || ctx.sesion.rol === "SUPER_ADMIN"}
        puedeElaborar={puedeElaborar}
        puedeRevisarJuridica={puedeRevisarJuridica}
        puedeConceptoJuridico={puedeConceptoJuridico}
        puedeAprobar={puedeAprobar}
        puedeSupervisar={puedeSupervisar}
        terceros={terceros.map((t) => ({ id: t.id, etiqueta: `${t.documento} · ${t.razonSocial}` }))}
        rpsDisponibles={rpsDisponibles.map((r) => ({ id: r.id, etiqueta: `${r.numero} · $${Number(r.valor).toLocaleString("es-CO")}` }))}
        estructuradores={estructuradores.map((u) => ({ id: u.id, etiqueta: `${u.nombre} ${u.apellido}` }))}
        abogados={abogados.map((u) => ({ id: u.id, etiqueta: `${u.nombre} ${u.apellido}` }))}
        contratos={contratos.map((c) => ({
          id: c.id,
          numero: c.numero,
          objeto: c.objeto,
          modalidad: c.modalidad,
          estado: c.estado,
          valorContrato: Number(c.valorContrato),
          tercero: c.tercero.razonSocial,
          estructuradorId: c.estructuradorId,
          estructuradorNombre: c.estructurador ? `${c.estructurador.nombre} ${c.estructurador.apellido}` : null,
          abogadoAsignadoId: c.abogadoAsignadoId,
          abogadoNombre: c.abogadoAsignado ? `${c.abogadoAsignado.nombre} ${c.abogadoAsignado.apellido}` : null,
          rpNumero: c.rp?.numero ?? null,
          proyectoCodigo: c.rp?.cdp.proyecto?.codigo ?? null,
          versiones: c.versiones.map((v) => ({
            id: v.id, numeroVersion: v.numeroVersion, tipo: v.tipo, aprobado: v.aprobado,
            contenido: v.contenido, observaciones: v.observaciones, createdAt: v.createdAt.toISOString(),
          })),
        }))}
      />
    </main>
  )
}

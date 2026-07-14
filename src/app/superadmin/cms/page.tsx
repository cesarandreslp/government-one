import Link from "next/link"
import { prismaMeta } from "@/lib/prisma-meta"

export const dynamic = "force-dynamic"

export default async function CmsPage() {
  const paginas = await prismaMeta.paginaCms.findMany({
    orderBy: { slug: "asc" },
    include: { _count: { select: { bloques: true } } },
  })

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/superadmin/tenants" className="text-sm text-blue-600 hover:underline">
          Tenants
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-700">CMS</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Contenido del sitio</h1>
      <p className="mt-1 text-sm text-slate-500">
        Páginas públicas del SaaS. Edita la landing y otras páginas; los cambios se reflejan en vivo.
      </p>

      <div className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {paginas.length === 0 && (
          <p className="p-6 text-sm text-slate-500">
            No hay páginas todavía. Siembra la landing con <code>npx tsx scripts/seed-cms.ts</code>.
          </p>
        )}
        {paginas.map((p) => (
          <Link
            key={p.id}
            href={`/superadmin/cms/${p.slug}`}
            className="flex items-center justify-between p-5 transition-colors hover:bg-slate-50"
          >
            <div>
              <div className="font-medium text-slate-900">{p.titulo}</div>
              <div className="text-sm text-slate-500">
                /{p.slug} · {p._count.bloques} bloques
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.publicada ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                {p.publicada ? "Publicada" : "Borrador"}
              </span>
              <span className="text-slate-400">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

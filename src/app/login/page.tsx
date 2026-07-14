import Link from "next/link"
import { LoginForm } from "./login-form"

export const metadata = {
  title: "Acceso administrativo — Government One",
}

// Next 16: searchParams es una Promise en componentes de página.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const destino = next?.startsWith("/superadmin") ? next : "/superadmin/tenants"

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 font-bold text-white">
              G1
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900">Government One</span>
          </Link>
          <h1 className="mt-6 text-xl font-semibold text-slate-900">Acceso administrativo</h1>
          <p className="mt-1 text-sm text-slate-500">Panel del control plane (SaaS)</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm next={destino} />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Acceso restringido a operadores de la plataforma.
        </p>
      </div>
    </main>
  )
}

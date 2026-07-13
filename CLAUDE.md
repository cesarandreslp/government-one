@AGENTS.md

> ⚠️ Next.js 16.2.10 puede tener breaking changes vs. conocimiento previo. Antes de codear features de
> Next, revisar `node_modules/next/dist/docs/` y las notas de deprecación (ver AGENTS.md).

# Government One — SaaS multi-tenant para entidades públicas colombianas

Rebuild greenfield limpio. La app vieja `../personeriabuga/` queda **solo como referencia** — NO se
migran sus datos (fueron pruebas).

## 📐 Lee esto primero
- **`docs/REBUILD_bitacora.md`** — reglas de oro, orden de construcción, decisiones firmes. **Entrar por aquí.**
- `docs/FUNDACION_estructura_organizacional.md` — fundación de dominio (dependencias + Cargo + vínculo + VU).
- `docs/FUNDACION_plano_de_control.md` — fundación de infra (provisioning + migraciones + ruteo a escala).
- `docs/VERIFICACION_neon_escala.md` — límites Neon (B1/B2 con Neon-sales pendientes).

## 🧱 Reglas de oro (no romper)
1. **Greenfield, sin migrar datos.** Se re-siembran tenants de prueba.
2. **Data-driven, CERO hardcode de entidad y CERO fallbacks a medida.** Lo que se muestra sale SIEMPRE
   de la data cargada. Sin dato = estado vacío/configurable. El código NO conoce ninguna entidad; solo
   primitivos + catálogos nacionales (CCPET, CGC, festivos, Res. 1519, catálogo de módulos) + plantillas
   por *tipo* de entidad (editables).
3. **Fundación primero, luego módulo por módulo VERIFICADO EN VIVO** antes del siguiente.
4. **El plano de control es producto de primera clase.** Nunca migraciones a mano — orquestador automático.

## 🏗️ Stack
Next.js (App Router) + TypeScript + Tailwind + Prisma + PostgreSQL (**Neon, BD por tenant**, aislamiento
fuerte) + Vercel. Arquitecturado para **escala masiva agresiva**.

## 🧭 Orden de construcción
1. **Fundación** (antes de cualquier módulo): plano de control (meta-DB + ruteo tenant + provisioning
   asíncrono + orquestador de migraciones) **+** dominio (árbol dependencias + Cargo + vínculo + VU).
2. **Portal Institucional** (bundle: Portal + Gestión Documental + Ventanilla Única + estructura organizacional).
3. **Financiero (contabilidad = libro mayor)** → Presupuesto → Banco de proyectos → Contratación → …

## ⚙️ Convención de trabajo
- Verificar en vivo (navegador) cada pieza antes de seguir. `npx tsc --noEmit` limpio antes de commit.
- Commit + push a `main` tras cada avance con sentido (Vercel despliega). `.env` nunca se commitea.

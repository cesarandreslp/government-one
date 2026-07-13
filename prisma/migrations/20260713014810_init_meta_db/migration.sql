-- CreateEnum
CREATE TYPE "TenantEstadoProvision" AS ENUM ('CREANDO_NEON', 'APLICANDO_SCHEMA', 'SEMBRANDO', 'ACTIVO', 'FALLIDO', 'SUSPENDIDO');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoEntidad" TEXT NOT NULL,
    "dominioPrincipal" TEXT NOT NULL,
    "dominioPersonalizado" TEXT,
    "neonProjectId" TEXT,
    "databaseUrl" TEXT,
    "databaseUrlDirect" TEXT,
    "secretosEncriptados" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 0,
    "estadoProvision" "TenantEstadoProvision" NOT NULL DEFAULT 'CREANDO_NEON',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_dominioPrincipal_key" ON "tenants"("dominioPrincipal");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_dominioPersonalizado_key" ON "tenants"("dominioPersonalizado");

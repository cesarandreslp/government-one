-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER', 'CONTRATISTA');

-- CreateEnum
CREATE TYPE "DependenciaTipo" AS ENUM ('DESPACHO', 'SECRETARIA', 'SUBSECRETARIA', 'DIRECCION', 'OFICINA');

-- CreateEnum
CREATE TYPE "VinculacionTipo" AS ENUM ('TITULAR', 'ENCARGADO', 'PROVISIONAL');

-- CreateEnum
CREATE TYPE "AusenciaTipo" AS ENUM ('VACACIONES', 'LICENCIA', 'COMISION', 'INCAPACIDAD');

-- CreateEnum
CREATE TYPE "GdTipoRadicado" AS ENUM ('ENTRADA', 'SALIDA', 'INTERNO');

-- CreateEnum
CREATE TYPE "GdEstadoRadicado" AS ENUM ('RADICADO', 'EN_TRAMITE', 'RESPONDIDO', 'ARCHIVADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "GdDisposicion" AS ENUM ('CONSERVACION_TOTAL', 'ELIMINACION', 'SELECCION', 'DIGITALIZACION');

-- CreateTable
CREATE TABLE "dependencias" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "DependenciaTipo" NOT NULL DEFAULT 'SECRETARIA',
    "esServicioCompartido" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "padreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dependencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos" (
    "id" TEXT NOT NULL,
    "dependenciaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "esJefatura" BOOLEAN NOT NULL DEFAULT false,
    "grants" JSONB NOT NULL DEFAULT '{}',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'USER',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculaciones_cargo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "tipo" "VinculacionTipo" NOT NULL DEFAULT 'TITULAR',
    "actoAdmin" TEXT,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vinculaciones_cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ausencias" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "AusenciaTipo" NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ausencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gd_series" (
    "id" TEXT NOT NULL,
    "dependenciaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gd_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gd_subseries" (
    "id" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "retencionGestion" INTEGER,
    "retencionCentral" INTEGER,
    "disposicion" "GdDisposicion",
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gd_subseries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gd_consecutivos" (
    "id" TEXT NOT NULL,
    "tipo" "GdTipoRadicado" NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "gd_consecutivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radicados" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" "GdTipoRadicado" NOT NULL,
    "anio" INTEGER NOT NULL,
    "consecutivo" INTEGER NOT NULL,
    "asunto" TEXT NOT NULL,
    "tercero" TEXT,
    "estado" "GdEstadoRadicado" NOT NULL DEFAULT 'RADICADO',
    "dependenciaId" TEXT,
    "subserieId" TEXT,
    "radicadoPorId" TEXT,
    "fechaRadicado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radicados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gd_adjuntos" (
    "id" TEXT NOT NULL,
    "radicadoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gd_adjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dependencias_codigo_key" ON "dependencias"("codigo");

-- CreateIndex
CREATE INDEX "dependencias_padreId_idx" ON "dependencias"("padreId");

-- CreateIndex
CREATE INDEX "cargos_dependenciaId_idx" ON "cargos"("dependenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "vinculaciones_cargo_usuarioId_idx" ON "vinculaciones_cargo"("usuarioId");

-- CreateIndex
CREATE INDEX "vinculaciones_cargo_cargoId_idx" ON "vinculaciones_cargo"("cargoId");

-- CreateIndex
CREATE INDEX "ausencias_usuarioId_idx" ON "ausencias"("usuarioId");

-- CreateIndex
CREATE INDEX "gd_series_dependenciaId_idx" ON "gd_series"("dependenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "gd_series_dependenciaId_codigo_key" ON "gd_series"("dependenciaId", "codigo");

-- CreateIndex
CREATE INDEX "gd_subseries_serieId_idx" ON "gd_subseries"("serieId");

-- CreateIndex
CREATE UNIQUE INDEX "gd_subseries_serieId_codigo_key" ON "gd_subseries"("serieId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "gd_consecutivos_tipo_anio_key" ON "gd_consecutivos"("tipo", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "radicados_numero_key" ON "radicados"("numero");

-- CreateIndex
CREATE INDEX "radicados_tipo_anio_idx" ON "radicados"("tipo", "anio");

-- CreateIndex
CREATE INDEX "radicados_dependenciaId_idx" ON "radicados"("dependenciaId");

-- CreateIndex
CREATE INDEX "radicados_estado_idx" ON "radicados"("estado");

-- CreateIndex
CREATE INDEX "gd_adjuntos_radicadoId_idx" ON "gd_adjuntos"("radicadoId");

-- AddForeignKey
ALTER TABLE "dependencias" ADD CONSTRAINT "dependencias_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "dependencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_dependenciaId_fkey" FOREIGN KEY ("dependenciaId") REFERENCES "dependencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculaciones_cargo" ADD CONSTRAINT "vinculaciones_cargo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculaciones_cargo" ADD CONSTRAINT "vinculaciones_cargo_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "cargos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gd_series" ADD CONSTRAINT "gd_series_dependenciaId_fkey" FOREIGN KEY ("dependenciaId") REFERENCES "dependencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gd_subseries" ADD CONSTRAINT "gd_subseries_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "gd_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radicados" ADD CONSTRAINT "radicados_dependenciaId_fkey" FOREIGN KEY ("dependenciaId") REFERENCES "dependencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radicados" ADD CONSTRAINT "radicados_subserieId_fkey" FOREIGN KEY ("subserieId") REFERENCES "gd_subseries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radicados" ADD CONSTRAINT "radicados_radicadoPorId_fkey" FOREIGN KEY ("radicadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gd_adjuntos" ADD CONSTRAINT "gd_adjuntos_radicadoId_fkey" FOREIGN KEY ("radicadoId") REFERENCES "radicados"("id") ON DELETE CASCADE ON UPDATE CASCADE;


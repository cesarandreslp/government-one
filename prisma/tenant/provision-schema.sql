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


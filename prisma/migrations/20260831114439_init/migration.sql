-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DOCENTE_AUXILIAR', 'DOCENTE_RESPONSABLE', 'UAP', 'DIRECCION_CARRERA', 'CONSEJO_DEPARTAMENTAL', 'ADMINISTRADOR');

-- CreateEnum
CREATE TYPE "PlanifStatus" AS ENUM ('BORRADOR', 'ENVIADO_A_REVISION', 'OBSERVADO', 'APROBADO_PEDAGOGICO', 'APROBADO_DISCIPLINAR', 'APROBADO_PLENO', 'ELEVADO_AL_CONSEJO', 'FINALIZADO');

-- CreateTable
CREATE TABLE "Sede" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "esCapital" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Departamento" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Departamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carrera" (
    "id" TEXT NOT NULL,
    "departamentoId" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,

    CONSTRAINT "Carrera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEstudio" (
    "id" TEXT NOT NULL,
    "carreraId" TEXT NOT NULL,
    "ordenanza" TEXT NOT NULL,
    "enfoque" TEXT NOT NULL DEFAULT 'TRADICIONAL',
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PlanEstudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asignatura" (
    "id" TEXT NOT NULL,
    "planEstudioId" TEXT NOT NULL,
    "departamentoRadicacionId" TEXT NOT NULL,
    "carreraEvaluadoraId" TEXT,
    "nombre" TEXT NOT NULL,
    "anoCursada" INTEGER NOT NULL,
    "regimen" TEXT NOT NULL,
    "creditoHorario" INTEGER NOT NULL,
    "contenidosMinimosOficiales" TEXT NOT NULL,

    CONSTRAINT "Asignatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "rol" "UserRole" NOT NULL,
    "carreraId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsignacionCatedra" (
    "id" TEXT NOT NULL,
    "asignaturaId" TEXT NOT NULL,
    "cicloLectivo" INTEGER NOT NULL,
    "docenteId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "esResponsable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsignacionCatedra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planificacion" (
    "id" TEXT NOT NULL,
    "asignaturaId" TEXT NOT NULL,
    "cicloLectivo" INTEGER NOT NULL,
    "docenteResponsableId" TEXT NOT NULL,
    "estado" "PlanifStatus" NOT NULL DEFAULT 'BORRADOR',
    "datosPaac" JSONB NOT NULL,
    "informePedagogico" JSONB,
    "informeDisciplinar" JSONB,
    "informeGeneral" JSONB,
    "numeroExpediente" TEXT,
    "numeroResolucion" TEXT,
    "fechaAprobacionCd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Planificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaadDocente" (
    "id" TEXT NOT NULL,
    "planificacionId" TEXT NOT NULL,
    "docenteId" TEXT NOT NULL,
    "cargoEnCatedra" TEXT NOT NULL,
    "datosPaad" JSONB NOT NULL,
    "estadoPresento" TEXT NOT NULL DEFAULT 'NO_PRESENTO',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaadDocente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemObservacion" (
    "id" TEXT NOT NULL,
    "planificacionId" TEXT NOT NULL,
    "documentoTipo" TEXT NOT NULL,
    "docentePaadId" TEXT,
    "campoPath" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "rolAutor" "UserRole" NOT NULL,
    "mensaje" TEXT NOT NULL,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemObservacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_dni_key" ON "Usuario"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "AsignacionCatedra_asignaturaId_cicloLectivo_docenteId_key" ON "AsignacionCatedra"("asignaturaId", "cicloLectivo", "docenteId");

-- CreateIndex
CREATE UNIQUE INDEX "Planificacion_asignaturaId_cicloLectivo_key" ON "Planificacion"("asignaturaId", "cicloLectivo");

-- CreateIndex
CREATE UNIQUE INDEX "PaadDocente_planificacionId_docenteId_key" ON "PaadDocente"("planificacionId", "docenteId");

-- AddForeignKey
ALTER TABLE "Carrera" ADD CONSTRAINT "Carrera_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carrera" ADD CONSTRAINT "Carrera_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEstudio" ADD CONSTRAINT "PlanEstudio_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "Carrera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignatura" ADD CONSTRAINT "Asignatura_planEstudioId_fkey" FOREIGN KEY ("planEstudioId") REFERENCES "PlanEstudio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignatura" ADD CONSTRAINT "Asignatura_departamentoRadicacionId_fkey" FOREIGN KEY ("departamentoRadicacionId") REFERENCES "Departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignatura" ADD CONSTRAINT "Asignatura_carreraEvaluadoraId_fkey" FOREIGN KEY ("carreraEvaluadoraId") REFERENCES "Carrera"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "Carrera"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionCatedra" ADD CONSTRAINT "AsignacionCatedra_asignaturaId_fkey" FOREIGN KEY ("asignaturaId") REFERENCES "Asignatura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionCatedra" ADD CONSTRAINT "AsignacionCatedra_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planificacion" ADD CONSTRAINT "Planificacion_asignaturaId_fkey" FOREIGN KEY ("asignaturaId") REFERENCES "Asignatura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planificacion" ADD CONSTRAINT "Planificacion_docenteResponsableId_fkey" FOREIGN KEY ("docenteResponsableId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaadDocente" ADD CONSTRAINT "PaadDocente_planificacionId_fkey" FOREIGN KEY ("planificacionId") REFERENCES "Planificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaadDocente" ADD CONSTRAINT "PaadDocente_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemObservacion" ADD CONSTRAINT "ItemObservacion_planificacionId_fkey" FOREIGN KEY ("planificacionId") REFERENCES "Planificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemObservacion" ADD CONSTRAINT "ItemObservacion_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Consolidate the former responsable and auxiliar account roles into DOCENTE.
ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM (
  'DOCENTE',
  'UAP',
  'DIRECCION_CARRERA',
  'ADMINISTRADOR',
  'CONSEJO_DEPARTAMENTAL'
);

ALTER TABLE "Usuario"
  ALTER COLUMN "rol" TYPE "UserRole"
  USING (
    CASE
      WHEN "rol"::text IN ('DOCENTE_AUXILIAR', 'DOCENTE_RESPONSABLE') THEN 'DOCENTE'
      ELSE "rol"::text
    END
  )::"UserRole";

ALTER TABLE "ItemObservacion"
  ALTER COLUMN "rolAutor" TYPE "UserRole"
  USING (
    CASE
      WHEN "rolAutor"::text IN ('DOCENTE_AUXILIAR', 'DOCENTE_RESPONSABLE') THEN 'DOCENTE'
      ELSE "rolAutor"::text
    END
  )::"UserRole";

DROP TYPE "UserRole_old";

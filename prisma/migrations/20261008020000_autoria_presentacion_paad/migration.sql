-- Las presentaciones antiguas no atribuyen una autoría que no estaba registrada.
ALTER TABLE "PresentacionPaad" ADD COLUMN "autorId" TEXT;
ALTER TABLE "PresentacionPaad" ADD COLUMN "rolAutor" "UserRole";
ALTER TABLE "PresentacionPaad" ADD CONSTRAINT "PresentacionPaad_autorId_fkey"
  FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

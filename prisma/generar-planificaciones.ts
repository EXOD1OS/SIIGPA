import { PrismaClient } from '@prisma/client';
import { loadEnvConfig } from '@next/env';
import { generarPlanificacionesDelCiclo } from '../src/lib/generar-planificaciones';

loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
const cicloLectivo = Number(process.argv[2] ?? new Date().getFullYear());

generarPlanificacionesDelCiclo(prisma, cicloLectivo)
  .then((resultado) => console.log(JSON.stringify({ cicloLectivo, ...resultado }, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

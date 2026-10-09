import { loadEnvConfig } from '@next/env';
import { PrismaClient } from '@prisma/client';
import { migrarPaads } from '../src/lib/migrar-paad';

loadEnvConfig(process.cwd());
const db = new PrismaClient();
migrarPaads(db).then(console.log).catch(error => {
  console.error(error); process.exitCode = 1;
}).finally(() => db.$disconnect());

import { PrismaClient } from '@prisma/client';

// Herramienta local de QA. Nunca elimina ni reinicia la base fuente.
const source = process.env.PAAD_SOURCE_DATABASE;
const clone = process.env.PAAD_CLONE_DATABASE;
const empty = process.env.PAAD_EMPTY_DATABASE;
const db = new PrismaClient();
async function main() {
  for (const name of [source, clone, empty]) {
    if (!name || !/^[a-z][a-z0-9_]+$/.test(name)) throw new Error('Indicá nombres seguros en PAAD_SOURCE_DATABASE, PAAD_CLONE_DATABASE y PAAD_EMPTY_DATABASE.');
  }
  if (new Set([source, clone, empty]).size !== 3) throw new Error('Las bases deben ser distintas.');
  const existing = await db.$queryRawUnsafe<{ datname: string }[]>('SELECT datname FROM pg_database WHERE datname = $1 OR datname = $2', clone, empty);
  if (existing.length) throw new Error('Elegí nombres nuevos; las bases QA ya existen.');
  await db.$executeRawUnsafe('CREATE DATABASE "' + clone + '" TEMPLATE "' + source + '"');
  await db.$executeRawUnsafe('CREATE DATABASE "' + empty + '"');
  console.log('Bases QA creadas sin modificar la fuente:', clone, empty);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());

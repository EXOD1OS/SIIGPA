import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { assertDomainDatabaseEmpty, domainDatabaseIsEmpty, occupiedDomainTables } from '../src/lib/database-state';

function databaseWithRows(occupied: string[], fail?: Error) {
  let queryCount = 0;
  const db = {
    async $queryRaw(query: Prisma.Sql) {
      queryCount++;
      if (fail) throw fail;
      const tables = Prisma.dmmf.datamodel.models.map(model => model.dbName ?? model.name);
      assert.deepEqual(query.values, tables);
      assert.doesNotMatch(query.sql, /INSERT|UPDATE|DELETE|TRUNCATE|DROP/i);
      return tables.map(tableName => ({ tableName, hasRows: occupied.includes(tableName) }));
    },
  } as unknown as Pick<Prisma.TransactionClient, '$queryRaw'>;
  return { db, queries: () => queryCount };
}

test('permite cargar demostración en una base completamente vacía', async () => {
  const { db, queries } = databaseWithRows([]);
  assert.equal(await domainDatabaseIsEmpty(db), true);
  await assertDomainDatabaseEmpty(db);
  assert.equal(queries(), 2);
});

test('protege cada tabla del dominio aunque no existan usuarios', async () => {
  for (const model of Prisma.dmmf.datamodel.models) {
    const tableName = model.dbName ?? model.name;
    const { db } = databaseWithRows([tableName]);
    assert.equal(await domainDatabaseIsEmpty(db), false, tableName);
    await assert.rejects(assertDomainDatabaseEmpty(db), /La base ya contiene datos/, tableName);
  }
});

test('informa las tablas ocupadas sin devolver contenido personal', async () => {
  const { db } = databaseWithRows(['Usuario', 'Planificacion']);
  assert.deepEqual((await occupiedDomainTables(db)).sort(), ['Planificacion', 'Usuario']);
});

test('un fallo de conexión impide continuar con el seed', async () => {
  const { db } = databaseWithRows([], new Error('Conexión de prueba no disponible'));
  await assert.rejects(domainDatabaseIsEmpty(db), /Conexión de prueba no disponible/);
  await assert.rejects(assertDomainDatabaseEmpty(db), /Conexión de prueba no disponible/);
});

test('una respuesta incompleta no se interpreta como base vacía', async () => {
  const db = { $queryRaw: async () => [] } as unknown as Pick<Prisma.TransactionClient, '$queryRaw'>;
  await assert.rejects(domainDatabaseIsEmpty(db), /estado completo de la base/);
});

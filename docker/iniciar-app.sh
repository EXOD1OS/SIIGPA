#!/bin/sh
set -eu
node docker/verificar-config.mjs
printf '%s\n' 'Aplicando las migraciones pendientes de PostgreSQL...'
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/tsx docker/preparar-base.ts
printf '%s\n' 'Iniciando SIGA en el puerto 3000...'
exec ./node_modules/.bin/next start --hostname 0.0.0.0 --port 3000

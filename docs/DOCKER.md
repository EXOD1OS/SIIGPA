# Instalar y actualizar SIGA con Docker

Requisitos: Git, Docker Engine en ejecución (por ejemplo Docker Desktop con contenedores Linux) y
Docker Compose 2.24 o posterior. No hace falta instalar Node, PostgreSQL ni Prisma en la PC.
La primera construcción necesita acceso a Internet y puede tardar varios minutos.

## Instalación nueva

Desde una terminal, clonar el repositorio y entrar a su carpeta:

```powershell
git clone https://github.com/EXOD1OS/UAP.git
cd UAP
docker compose -f docker-compose.preparar.yml run --rm preparar
docker compose up -d --build
docker compose ps
```

En Windows, tras ese único paso de preparación también se puede ejecutar `INICIAR_DEMO.cmd`. Para usar otra
configuración privada: `INICIAR_DEMO.cmd D:\configuracion\siga.env`. No se copian archivos privados al
repositorio ni a la imagen.

Abrir http://localhost:3000. El comando de preparación genera `.env.docker` y `config/minio/root.env`
con claves aleatorias. Repetirlo conserva los archivos existentes. Ninguno se sube a Git ni se copia a
la imagen. Si el puerto 3000 está ocupado, cambiar `APP_PORT` y `NEXTAUTH_URL` en `.env.docker`;
por ejemplo, `APP_PORT=3001` y `NEXTAUTH_URL=http://localhost:3001`.

El arranque espera a PostgreSQL, aplica `prisma migrate deploy`, carga la demostración **solo si todas
las tablas del dominio están vacías** y `DEMO_SEED_IF_EMPTY=true`, ejecuta la conversión repetible de
PAAD y arranca la aplicación compilada. En bases existentes no repite el seed. Si una carga se interrumpe,
el siguiente arranque conserva lo que haya y no reinicia ni borra la base para intentarlo de nuevo.
Revisar el error antes de continuar.

Las cuentas de demostración se detallan en el README; por ejemplo, `admin@unlar.edu.ar`,
`uap@unlar.edu.ar` y `titular.prog@unlar.edu.ar`, contraseña `unlar2026`.
Las materias, docentes y asignaciones de ISI están en el seed del repositorio: no requieren el Excel original.
El ciclo de los ejemplos es 2026; para otros años usar el filtro o iniciar un ciclo desde Administración.
`DEMO_SEED_IF_EMPTY=false` permite omitir la demostración, pero no crea una cuenta administrativa por sí solo.

## Habilitar MinIO AIStor

El perfil `minio` agrega el servidor AIStor y un inicializador que se ejecuta una vez por arranque.
AIStor requiere una **licencia válida propia**. El repositorio no incluye ni genera licencias.
Consultar la [instalación oficial de AIStor](https://docs.min.io/aistor/installation/container/install/).
Sin ese perfil se puede usar el circuito académico; el archivado final de PDF requiere el almacenamiento.

1. Colocar la licencia en `config/minio/minio.license` o definir `MINIO_LICENSE_FILE` en `.env.docker`
   con la ruta del archivo real. La ruta puede ser relativa al repositorio o absoluta; en Windows se
   recomienda escribirla con `/`. No usar una carpeta en lugar del archivo.
2. Para una instalación nueva, la preparación ya generó `config/minio/root.env` con las credenciales
   administrativas. Si ya hay AIStor, conservar su `root.env` y seleccionar ese archivo mediante
   `MINIO_ROOT_ENV_FILE` en `.env.docker`. Debe definir `MINIO_ROOT_USER` y `MINIO_ROOT_PASSWORD`.
   **No cambiar las credenciales ni la imagen de un AIStor existente durante esta adaptación.**
   Definir `MINIO_IMAGE` con la misma imagen/versión de su instalación si difiere de la predeterminada.
3. El archivo `.env.docker` tiene `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY` para el usuario de SIGA.
   Mantenerlas distintas de la cuenta root. Para reutilizar un usuario existente, copiar sus valores
   correctos desde la configuración privada anterior; el inicializador no cambia su contraseña.
4. Iniciar el conjunto:

```powershell
docker compose -f docker-compose.yml -f docker-compose.minio.yml --env-file .env.docker --profile minio up -d --build
docker compose -f docker-compose.yml -f docker-compose.minio.yml --env-file .env.docker --profile minio ps -a
docker compose -f docker-compose.yml -f docker-compose.minio.yml --env-file .env.docker --profile minio logs --tail 100 minio minio-init app
```

El servidor usa el puerto 9000 para S3 y http://localhost:9001 para la consola. Entrar a la consola
con las credenciales de su `root.env`, nunca enviarlas por chat ni guardarlas en Git.
El inicializador crea el bucket `S3_BUCKET` si falta, crea el usuario de SIGA si no existe, le asigna
una política limitada a leer y escribir en ese bucket y verifica el acceso. Conserva los objetos existentes.
Si una credencial existente no coincide, falla e indica revisar la configuración; no la reemplaza.
La aplicación espera a que finalice esta preparación cuando se usa el archivo adicional
`docker-compose.minio.yml`; por eso debe conservarse en todos los comandos con `--profile minio`.
En Windows equivale a `INICIAR_DEMO.cmd --minio`.

Los puertos publicados se limitan a `127.0.0.1`, para uso local. Para un despliegue de red hace falta
configurar publicación, URL pública y HTTPS; esta guía prepara una instalación local de desarrollo/demostración.
Las credenciales PostgreSQL `postgres/postgres` se conservan por compatibilidad con la base demo anterior;
no publicar ese puerto en una red externa.

## Actualizar conservando datos y configuración

Conservar el mismo directorio de proyecto y nombre de proyecto Compose. Los volúmenes históricos siguen
llamándose `siga_pg_data` y `siga_minio_data` dentro del proyecto; por ejemplo, `uap_siga_pg_data`.
No copiar el proyecto a otra carpeta o cambiar `-p` suponiendo que verá automáticamente los mismos datos.
Los archivos y la base reales permanecen en los volúmenes, no en GitHub.

Antes de actualizar una instalación con información importante, hacer respaldo de PostgreSQL y del bucket.
Guardar `.env.docker`, `root.env` y la licencia en un lugar seguro. No reemplazarlos por los ejemplos.
Si `git status` muestra cambios locales (por ejemplo, el Compose anterior del compañero), guardarlos en una
rama/commit local o en una copia antes de traer cambios; no sobrescribirlos con un reset forzado.

```powershell
git pull --ff-only origin main
docker compose -f docker-compose.yml -f docker-compose.minio.yml --env-file .env.docker --profile minio up -d --build
docker compose -f docker-compose.yml -f docker-compose.minio.yml --env-file .env.docker --profile minio ps -a
```

Omitir el segundo archivo y `--profile minio` si no se usa ese servicio. `up --build` incorpora el código nuevo a la imagen,
recrea los contenedores necesarios y mantiene los volúmenes. Las migraciones se aplican automáticamente.
No ejecutar `db:reset`, `prisma migrate reset`, `docker compose down -v` ni borrar volúmenes al actualizar.
Para detener sin eliminar datos: `docker compose --env-file .env.docker --profile minio stop`.

Si antes se usaban `../../../minio/root.env` y `../../../minio/minio.license`, indicar esas rutas en
`MINIO_ROOT_ENV_FILE` y `MINIO_LICENSE_FILE` del archivo privado. No es necesario mover ni publicar esos archivos.
La aplicación dentro de Docker usa `db:5432` y `minio:9000`; `localhost` dentro de un contenedor no es otro servicio.
El desarrollo fuera de Docker sigue usando los puertos de la PC (`localhost:5433`, `localhost:9000`).

## Comprobaciones y problemas de arranque

```powershell
docker compose --env-file .env.docker config --quiet
docker compose -f docker-compose.yml -f docker-compose.minio.yml --env-file .env.docker --profile minio config --quiet
docker compose --env-file .env.docker logs --tail 100 app db
```

No compartir la salida completa de `docker compose config`: puede contener claves. Usar `--quiet` para
validar sin mostrarlas. `http://localhost:3000/api/health` devuelve `{"estado":"ok"}` cuando la aplicación
puede consultar PostgreSQL. `app` debe aparecer como `healthy`; `minio-init` como `Exited (0)` si se usa MinIO.

- **Falta NEXTAUTH_SECRET:** ejecutar la preparación y usar `--env-file .env.docker`.
- **Licencia inexistente/no válida:** revisar `MINIO_LICENSE_FILE` y los registros de `minio`. No crear un
  archivo vacío ni agregar una licencia ajena al repositorio.
- **No se puede conectar a Docker:** iniciar Docker Engine/Desktop y seleccionar contenedores Linux.
- **Puerto ocupado:** ajustar los puertos del archivo privado y `NEXTAUTH_URL` si cambia el de la web.
- **El seed rechaza la base:** ya tiene datos; se protege su contenido. Actualizar con migraciones, no resetearla.
- **Falló la conversión de PAAD:** conservar la base y revisar sus antecedentes y el error. No forzar su reemplazo.
- **MinIO no inicia en una base antigua:** conservar la imagen y credenciales de esa instalación; no intentar
  un downgrade ni montar el volumen AIStor con otra edición de MinIO.

La imagen de SIGA usa Node 22, `npm ci`, Prisma generado en Linux y el paquete completo de PDFKit con
sus fuentes. `.dockerignore` excluye dependencias/builds de la PC y archivos privados, evitando reutilizar
binarios de Windows o compilaciones viejas al construir en otro equipo.

## Validación de esta configuración

Se verificó una instalación aislada con PostgreSQL nuevo: migraciones, carga inicial de demostración,
inicio de sesión, panel autenticado, generación de PDF y reinicio sin duplicar datos. También se validaron
las configuraciones Compose normal y con el perfil AIStor. La prueba completa de AIStor requiere una licencia
válida y credenciales externas del titular; no se simula ni se incluye una licencia en el repositorio.

#!/bin/sh
# Prepara el bucket y una cuenta de aplicación en AIStor sin borrar documentos.
# La clave de un usuario existente nunca se sustituye durante una actualización.
set -eu
umask 077

fallar() {
  printf 'Error al preparar MinIO AIStor: %s\n' "$1" >&2
  exit 1
}

[ -n "${MINIO_ROOT_USER:-}" ] || fallar 'falta MINIO_ROOT_USER en el archivo externo de la cuenta root.'
[ -n "${MINIO_ROOT_PASSWORD:-}" ] || fallar 'falta MINIO_ROOT_PASSWORD en el archivo externo de la cuenta root.'
[ -n "${S3_ACCESS_KEY_ID:-}" ] || fallar 'falta S3_ACCESS_KEY_ID.'
[ -n "${S3_SECRET_ACCESS_KEY:-}" ] || fallar 'falta S3_SECRET_ACCESS_KEY.'
[ -n "${S3_BUCKET:-}" ] || fallar 'falta S3_BUCKET.'
[ "$S3_ACCESS_KEY_ID" != "$MINIO_ROOT_USER" ] || fallar 'la aplicación debe usar una cuenta distinta de root.'
[ "${#S3_SECRET_ACCESS_KEY}" -ge 8 ] || fallar 'S3_SECRET_ACCESS_KEY debe tener al menos 8 caracteres.'

# El nombre se incorpora a una política JSON; solo se admiten caracteres S3.
case "$S3_BUCKET" in
  *[!a-z0-9.-]*|.*|*.|-*|*-|*..*) fallar 'S3_BUCKET debe usar minúsculas, números, guiones o puntos, sin extremos especiales ni puntos consecutivos.' ;;
esac
[ "${#S3_BUCKET}" -ge 3 ] && [ "${#S3_BUCKET}" -le 63 ] || fallar 'S3_BUCKET debe tener entre 3 y 63 caracteres.'

endpoint=${MINIO_ENDPOINT:-http://minio:9000}
endpoint=${endpoint%/}
case "$endpoint" in
  http://*|https://*) ;;
  *) fallar 'MINIO_ENDPOINT debe ser una URL HTTP(S).' ;;
esac
case "$endpoint" in
  *'@'*|*'?'*|*'#'*) fallar 'MINIO_ENDPOINT no debe incluir credenciales, parámetros ni fragmentos.' ;;
esac

command -v mc >/dev/null 2>&1 || fallar 'la imagen no incluye el cliente mc.'
command -v curl >/dev/null 2>&1 || fallar 'la imagen no incluye curl.'
config_dir=$(mktemp -d /tmp/siga-minio-init.XXXXXX) || fallar 'no se pudo preparar la configuración temporal.'
trap 'rm -rf "$config_dir"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
export MC_CONFIG_DIR="$config_dir"
export MC_NO_COLOR=1

printf 'Esperando a MinIO AIStor...\n'
intento=0
until curl --fail --silent --max-time 4 "$endpoint/minio/health/ready" >/dev/null 2>&1; do
  intento=$((intento + 1))
  [ "$intento" -lt 30 ] || fallar 'el servicio no está listo. Revisá su estado, la licencia y MINIO_ENDPOINT.'
  sleep 2
done

# Las credenciales viajan por stdin y se guardan solo en el directorio temporal.
printf '%s\n%s\n' "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" \
  | mc alias set --api S3v4 --path on siga-admin "$endpoint" >/dev/null 2>&1 \
  || fallar 'no se pudo configurar la conexión root. Revisá el archivo externo de credenciales.'
mc mb --ignore-existing "siga-admin/$S3_BUCKET" >/dev/null 2>&1 \
  || fallar 'no se pudo autenticar root o crear/comprobar el bucket.'

if mc --json admin user info siga-admin "$S3_ACCESS_KEY_ID" > "$config_dir/user-info.json" 2>&1; then
  printf 'La cuenta de aplicación ya existe; se conserva su clave.\n'
else
  # mc --json emite JSON compacto. Solo la respuesta explícita de usuario
  # inexistente autoriza el alta; un fallo de red o permisos nunca rota claves.
  case "$(cat "$config_dir/user-info.json")" in
    *'"Code":"XMinioAdminNoSuchUser"'*|*'"code":"XMinioAdminNoSuchUser"'*)
      printf '%s\n%s\n' "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" \
        | mc admin user add siga-admin >/dev/null 2>&1 \
        || fallar 'no se pudo crear el usuario de aplicación.'
      ;;
    *) fallar 'no se pudo comprobar si existe el usuario de aplicación. Se conserva su configuración; revisá la conexión y permisos de root.' ;;
  esac
fi

policy_name="siga-app-$S3_BUCKET"
policy_file="$config_dir/app-policy.json"
printf '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetBucketLocation","s3:ListBucket"],"Resource":["arn:aws:s3:::%s"]},{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject"],"Resource":["arn:aws:s3:::%s/*"]}]}\n' \
  "$S3_BUCKET" "$S3_BUCKET" > "$policy_file"
mc admin policy create siga-admin "$policy_name" "$policy_file" >/dev/null 2>&1 \
  || fallar 'no se pudo crear o actualizar la política del bucket.'
mc admin policy attach siga-admin "$policy_name" --user "$S3_ACCESS_KEY_ID" >/dev/null 2>&1 \
  || fallar 'no se pudo asignar la política al usuario de aplicación.'

printf '%s\n%s\n' "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" \
  | mc alias set --api S3v4 --path on siga-app "$endpoint" >/dev/null 2>&1 \
  || fallar 'no se pudo configurar la conexión de la aplicación.'
mc stat "siga-app/$S3_BUCKET" >/dev/null 2>&1 \
  || fallar 'las credenciales S3 de la aplicación no permiten acceder al bucket. Si el usuario ya existía, usá su clave actual; no se modificó su clave.'

printf 'MinIO AIStor listo: bucket privado y acceso de aplicación comprobados.\n'

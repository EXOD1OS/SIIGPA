@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "ENV_FILE=.env.docker"
set "USAR_MINIO="

:leer_argumentos
if "%~1"=="" goto comprobar
if /I "%~1"=="--minio" (
  set "USAR_MINIO=1"
  shift
  goto leer_argumentos
)
if /I "%~1"=="--ayuda" goto ayuda
if "%ENV_FILE%"==".env.docker" (
  set "ENV_FILE=%~1"
  shift
  goto leer_argumentos
)
echo Error: solo se admite una ruta de configuracion y la opcion --minio.
goto fin_error

:comprobar
if not exist "%ENV_FILE%" (
  echo Error: no se encontro "%ENV_FILE%".
  echo Para una instalacion nueva ejecute primero:
  echo   docker compose -f docker-compose.preparar.yml run --rm preparar
  echo Luego vuelva a abrir este archivo.
  goto fin_error
)
set "APP_CONFIG_FILE=%ENV_FILE%"

docker version >nul 2>&1
if errorlevel 1 (
  echo Error: Docker Engine no esta disponible. Inicie Docker Desktop y espere a que finalice.
  goto fin_error
)
docker compose version >nul 2>&1
if errorlevel 1 (
  echo Error: Docker Compose v2 no esta disponible. Actualice Docker Desktop o Docker Compose.
  goto fin_error
)

if defined USAR_MINIO goto iniciar_minio

docker compose --env-file "%ENV_FILE%" config --quiet
if errorlevel 1 (
  echo Error: la configuracion de Docker no es valida. Revise "%ENV_FILE%" sin compartir sus claves.
  goto fin_error
)
docker compose --env-file "%ENV_FILE%" up -d --build
if errorlevel 1 goto fin_error
docker compose --env-file "%ENV_FILE%" ps
echo.
echo SIGA esta disponible en la URL indicada por NEXTAUTH_URL en "%ENV_FILE%".
goto fin_ok

:iniciar_minio
docker compose -f docker-compose.yml -f docker-compose.minio.yml --env-file "%ENV_FILE%" --profile minio config --quiet
if errorlevel 1 (
  echo Error: la configuracion de AIStor no es valida. Revise licencia, root.env y "%ENV_FILE%".
  goto fin_error
)
docker compose -f docker-compose.yml -f docker-compose.minio.yml --env-file "%ENV_FILE%" --profile minio up -d --build
if errorlevel 1 goto fin_error
docker compose -f docker-compose.yml -f docker-compose.minio.yml --env-file "%ENV_FILE%" --profile minio ps -a
echo.
echo SIGA y AIStor fueron solicitados. Revise que minio-init termine con Exited (0).
goto fin_ok

:ayuda
echo Uso: INICIAR_DEMO.cmd [ruta_al_env] [--minio]
echo.
echo Sin argumentos usa .env.docker y levanta SIGA con PostgreSQL.
echo --minio agrega AIStor y exige licencia y credenciales externas configuradas.
goto fin_ok

:fin_error
endlocal
exit /b 1

:fin_ok
endlocal
exit /b 0

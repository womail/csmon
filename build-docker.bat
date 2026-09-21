@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo === csmon: build image and start container ===
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo Docker is not installed or not on PATH.
  echo Install Docker Desktop, then run this file again.
  goto :end
)

docker compose version >nul 2>&1
if not errorlevel 1 (
  set "USE_COMPOSE_V1="
) else (
  docker-compose version >nul 2>&1
  if errorlevel 1 (
    echo Docker Compose is not available.
    echo Install Docker Desktop or the Compose plugin.
    goto :end
  )
  set "USE_COMPOSE_V1=1"
)

echo Building csmon:local from Dockerfile...
if defined USE_COMPOSE_V1 (
  docker-compose build
) else (
  docker compose build
)
if errorlevel 1 goto :end

echo.
echo Creating and starting the container...
if defined USE_COMPOSE_V1 (
  docker-compose up -d
) else (
  docker compose up -d
)
if errorlevel 1 goto :end

echo.
echo csmon is running at http://127.0.0.1:3000
echo SQLite data stays in the csmon-data volume.
echo.
echo Logs:  docker compose logs -f csmon
echo Stop:  docker compose down

:end
if /i "%~1"=="--nopause" goto :eof
echo.
pause

@echo off
chcp 65001 >nul
title SERVIDOR GRUPO ICA — Instalacion
color 0A

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║     GRUPO ICA — INSTALACION SERVIDOR     ║
echo  ╚══════════════════════════════════════════╝
echo.

:: ── 1. Verificar Python ─────────────────────────────────────────────
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Python no encontrado. Instalando...
    winget install Python.Python.3.11 --accept-source-agreements --accept-package-agreements
    echo  [✓] Python instalado. REINICIA este script.
    pause
    exit
)
echo  [✓] Python encontrado.

:: ── 2. Clonar o actualizar repositorio ──────────────────────────────
if not exist "grupoica-intranet" (
    echo  [*] Clonando repositorio...
    git clone https://github.com/informatica2grupoica-stack/grupoica-intranet.git
    if %errorlevel% neq 0 (
        echo  [!] ERROR clonando repo. Verifica conexion a internet.
        pause
        exit
    )
    echo  [✓] Repositorio clonado.
) else (
    echo  [✓] Repositorio ya existe.
)

cd grupoica-intranet

:: ── 3. Instalar dependencias Python ─────────────────────────────────
echo  [*] Instalando dependencias Python...
pip install requests flask flask-cors beautifulsoup4 lxml openpyxl --quiet
echo  [✓] Dependencias instaladas.

:: ── 4. Descargar cloudflared ─────────────────────────────────────────
if not exist "..\cloudflared.exe" (
    echo  [*] Descargando Cloudflare Tunnel...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '..\cloudflared.exe'"
    echo  [✓] cloudflared descargado.
) else (
    echo  [✓] cloudflared ya existe.
)

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║         INSTALACION COMPLETADA           ║
echo  ║   Ahora ejecuta: INICIAR-SERVIDOR.bat    ║
echo  ╚══════════════════════════════════════════╝
echo.
pause

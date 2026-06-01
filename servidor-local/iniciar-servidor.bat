@echo off
chcp 65001 >nul
title SERVIDOR GRUPO ICA
color 0A

echo.
echo  ============================================
echo    INICIANDO SERVIDOR GRUPO ICA INTRANET
echo  ============================================
echo.

:: ── Ir al repo ───────────────────────────────────────────────────────────────
if exist "grupoica-intranet" (
    cd grupoica-intranet
) else (
    echo  [!] No se encontro la carpeta grupoica-intranet
    echo  [!] Ejecuta primero instalar.bat
    pause
    exit
)

:: ── Actualizar repositorio ───────────────────────────────────────────────────
echo  [INFO] Actualizando repositorio...
git pull origin main
echo.

:: ── Verificar dependencias ───────────────────────────────────────────────────
echo  [INFO] Verificando dependencias Python...
pip install requests flask flask-cors waitress beautifulsoup4 lxml openpyxl playwright --quiet --exists-action i
echo.

:: ── Iniciar Flask en ventana separada ────────────────────────────────────────
echo  [OK] Iniciando servidor Flask en ventana separada...
start "Flask ICA" /min python api/index.py
echo  [INFO] Esperando 3 segundos para que Flask arranque...
timeout /t 3 /nobreak >nul

:: ── Iniciar Tunnel con auto-update Vercel (via Python) ───────────────────────
echo.
echo  ============================================
echo    TUNEL CLOUDFLARED
echo    Vercel se actualiza AUTOMATICAMENTE
echo  ============================================
echo.

python servidor-local\arrancar-tunnel.py

pause

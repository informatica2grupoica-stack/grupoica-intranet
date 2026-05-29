@echo off
chcp 65001 >nul
title SERVIDOR GRUPO ICA
color 0A

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║       GRUPO ICA — SERVIDOR ACTIVO        ║
echo  ╚══════════════════════════════════════════╝
echo.

:: Ir al repo
if exist "grupoica-intranet" (
    cd grupoica-intranet
) else (
    echo  [!] No se encontro la carpeta grupoica-intranet
    echo  [!] Ejecuta primero instalar.bat
    pause
    exit
)

:: ── Iniciar Flask en segundo plano ──────────────────────────────────
echo  [*] Iniciando servidor Flask en puerto 5000...
start "Flask ICA" /min python api/index.py
timeout /t 3 /nobreak >nul
echo  [✓] Flask corriendo en http://localhost:5000

:: ── Iniciar Cloudflare Tunnel ────────────────────────────────────────
echo.
echo  [*] Creando tunel publico con Cloudflare...
echo  [*] Espera la linea que dice "trycloudflare.com"...
echo  [*] Copia esa URL y enviasela a tu companero
echo.
echo  ════════════════════════════════════════════
..\cloudflared.exe tunnel --url http://localhost:5000
echo  ════════════════════════════════════════════

pause

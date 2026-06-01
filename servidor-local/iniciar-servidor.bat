@echo off
chcp 65001 >nul
title SERVIDOR GRUPO ICA
color 0A

echo.
echo  ============================================
echo    INICIANDO SERVIDOR GRUPO ICA INTRANET
echo  ============================================
echo.

:: ── Ir al repo ───────────────────────────────────────────────────────
if exist "grupoica-intranet" (
    cd grupoica-intranet
) else (
    echo  [!] No se encontro la carpeta grupoica-intranet
    echo  [!] Ejecuta primero instalar.bat
    pause
    exit
)

:: ── Actualizar repositorio ───────────────────────────────────────────
echo  [INFO] Actualizando repositorio...
git pull origin main
echo.

:: ── Verificar dependencias ───────────────────────────────────────────
echo  [INFO] Verificando dependencias Python...
pip install requests flask flask-cors waitress beautifulsoup4 lxml openpyxl --quiet --exists-action i
echo.

:: ── Iniciar Flask en ventana separada ───────────────────────────────
echo  [OK] Iniciando servidor Flask en ventana separada...
start "Flask ICA" /min python api/index.py
echo  [INFO] Esperando 3 segundos para que Flask arranque...
timeout /t 3 /nobreak >nul

:: ── Iniciar Cloudflare Tunnel y capturar URL ─────────────────────────
echo.
echo  ============================================
echo    TUNEL CLOUDFLARED - URL PUBLICA
echo    Busca la linea:
echo    https://XXXX.trycloudflare.com
echo  ============================================
echo.

:: Lanzar cloudflared y guardar output en archivo temporal
set TUNNEL_LOG=%TEMP%\ica_tunnel.log
if exist "%TUNNEL_LOG%" del "%TUNNEL_LOG%"

start "Cloudflare Tunnel" /min cmd /c "..\cloudflared.exe tunnel --url http://localhost:5000 > %TUNNEL_LOG% 2>&1"

:: Esperar hasta que aparezca la URL en el log (máx 30 seg)
echo  [INFO] Esperando URL del tunnel...
set TUNNEL_URL=
set /a INTENTOS=0

:BUSCAR_URL
timeout /t 2 /nobreak >nul
set /a INTENTOS+=1
if %INTENTOS% GTR 15 goto TIMEOUT_TUNNEL

:: Buscar la línea con trycloudflare.com en el log
for /f "tokens=* delims=" %%L in ('findstr /i "trycloudflare.com" "%TUNNEL_LOG%" 2^>nul') do (
    for /f "tokens=* delims= " %%U in ("%%L") do (
        echo %%U | findstr /i "https://" >nul 2>&1
        if not errorlevel 1 (
            :: Extraer solo la URL https://xxx.trycloudflare.com
            for /f "tokens=1 delims= " %%X in ('echo %%U') do (
                echo %%X | findstr /i "https://.*trycloudflare" >nul 2>&1
                if not errorlevel 1 set TUNNEL_URL=%%X
            )
        )
    )
)
if "%TUNNEL_URL%"=="" goto BUSCAR_URL

:TUNNEL_OK
echo.
echo  [OK] Tunnel activo: %TUNNEL_URL%
echo.

:: ── Auto-actualizar Vercel con la nueva URL ───────────────────────────
:: Para activar esta función, crea el archivo: servidor-local\vercel-config.txt
:: con el contenido:  TOKEN=tu_token_vercel
::                    PROJECT_ID=tu_project_id
set VERCEL_CONFIG=vercel-config.txt
if not exist "%VERCEL_CONFIG%" (
    echo  [INFO] Sin vercel-config.txt — copia la URL manualmente en Vercel:
    echo  [URL] %TUNNEL_URL%
    echo.
    goto MANTENER_ACTIVO
)

:: Leer token y project ID del archivo de config
for /f "tokens=1,2 delims==" %%A in (%VERCEL_CONFIG%) do (
    if "%%A"=="TOKEN"      set VERCEL_TOKEN=%%B
    if "%%A"=="PROJECT_ID" set VERCEL_PROJECT_ID=%%B
)

if "%VERCEL_TOKEN%"=="" (
    echo  [!] TOKEN no encontrado en vercel-config.txt
    goto MANTENER_ACTIVO
)

echo  [INFO] Actualizando Vercel con nueva URL del tunnel...
powershell -Command ^
  "$headers = @{Authorization='Bearer %VERCEL_TOKEN%'; 'Content-Type'='application/json'};" ^
  "$body = '{\"key\":\"PYTHON_BACKEND_URL\",\"value\":\"%TUNNEL_URL%\",\"type\":\"plain\",\"target\":[\"production\",\"preview\"]}';" ^
  "try { $r = Invoke-RestMethod -Uri 'https://api.vercel.com/v10/projects/%VERCEL_PROJECT_ID%/env' -Method POST -Headers $headers -Body $body -ErrorAction Stop; Write-Host '[OK] Vercel actualizado: %TUNNEL_URL%' } catch { Write-Host '[!] Error Vercel:' $_.Exception.Message }"

:: Hacer redeploy automático
powershell -Command ^
  "$headers = @{Authorization='Bearer %VERCEL_TOKEN%'; 'Content-Type'='application/json'};" ^
  "try { $r = Invoke-RestMethod -Uri 'https://api.vercel.com/v13/deployments' -Method POST -Headers $headers -Body '{\"name\":\"grupoica-intranet\",\"target\":\"production\"}' -ErrorAction Stop; Write-Host '[OK] Redeploy iniciado' } catch { Write-Host '[INFO] Redeploy manual en vercel.com' }"

echo.

:MANTENER_ACTIVO
echo  ============================================
echo   Servidor activo. NO cierres esta ventana.
echo   Para detener: cierra esta ventana.
echo  ============================================
echo.

:: Mantener vivo mostrando la URL cada 30 segundos
:LOOP
timeout /t 30 /nobreak >nul
echo  [%TIME%] Servidor activo — %TUNNEL_URL%
goto LOOP

:TIMEOUT_TUNNEL
echo  [!] No se pudo obtener la URL del tunnel automaticamente.
echo  [!] Revisa la ventana "Cloudflare Tunnel" para copiar la URL.
echo.
goto MANTENER_ACTIVO

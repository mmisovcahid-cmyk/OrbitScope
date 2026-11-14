@echo off
setlocal EnableExtensions EnableDelayedExpansion
title OrbitScope
cd /d "%~dp0"

echo ========================================================
echo   OrbitScope - tek tikla baslat / one-click start
echo ========================================================
echo.

rem ---------------------------------------------------------- requirements
where python >nul 2>&1
if errorlevel 1 (
  echo [HATA] Python bulunamadi. Python 3.10+ kurun: https://www.python.org/downloads/
  echo        Kurulumda "Add python.exe to PATH" secenegini isaretleyin.
  goto :fail
)
where npm >nul 2>&1
if errorlevel 1 (
  echo [HATA] Node.js / npm bulunamadi. Node.js 18+ kurun: https://nodejs.org/
  goto :fail
)

rem ---------------------------------------------------------- first-run setup
if not exist "backend\.env" (
  echo [kurulum] backend\.env olusturuluyor ^(.env.example kopyasi^)...
  copy /y "backend\.env.example" "backend\.env" >nul
)

python -c "import fastapi, uvicorn, astropy, scipy, httpx, cachetools, PIL" >nul 2>&1
if errorlevel 1 (
  echo [kurulum] Python paketleri kuruluyor ^(ilk sefer, birkac dakika^)...
  python -m pip install -r "backend\requirements.txt"
  if errorlevel 1 (
    echo [HATA] Python paketleri kurulamadi.
    goto :fail
  )
)

if not exist "frontend\node_modules" (
  echo [kurulum] Frontend paketleri kuruluyor ^(npm install, ilk sefer^)...
  pushd frontend
  call npm install
  if errorlevel 1 (
    popd
    echo [HATA] npm install basarisiz oldu.
    goto :fail
  )
  popd
)

rem ---------------------------------------------------------- busy ports
call :freeport 8000 Backend
if errorlevel 1 goto :fail
call :freeport 5173 Frontend
if errorlevel 1 goto :fail

rem ---------------------------------------------------------- start
echo.
echo [1/2] Backend baslatiliyor: http://localhost:8000
start "OrbitScope Backend" /d "%~dp0backend" cmd /k python run.py

echo [2/2] Frontend baslatiliyor: http://localhost:5173
start "OrbitScope Frontend" /d "%~dp0frontend" cmd /k npm run dev

echo.
echo Backend hazir olana kadar bekleniyor...
set /a tries=0
:waitloop
set /a tries+=1
curl -s -o nul http://127.0.0.1:8000/ >nul 2>&1
if not errorlevel 1 goto :ready
if !tries! geq 60 (
  echo [UYARI] Backend 60 saniyede yanit vermedi. "OrbitScope Backend" penceresindeki hataya bakin.
  goto :open
)
timeout /t 1 /nobreak >nul
goto :waitloop

:ready
echo Backend hazir.
timeout /t 2 /nobreak >nul

:open
start "" http://localhost:5173
echo.
echo ========================================================
echo   OrbitScope calisiyor / is running
echo   Uygulama : http://localhost:5173
echo   API      : http://localhost:8000/docs
echo   Durdurmak icin "OrbitScope Backend" ve "OrbitScope Frontend"
echo   pencerelerini kapatin.
echo ========================================================
echo.
pause
exit /b 0

rem ---------------------------------------------------------- helpers
:freeport
rem %1 = port, %2 = label. If something listens on the port, ask before closing it.
set "pid="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%1 .*LISTENING"') do set "pid=%%p"
if not defined pid exit /b 0
echo.
echo [UYARI] Port %1 ^(%2^) zaten kullaniliyor ^(PID !pid!^). Muhtemelen eski bir OrbitScope sunucusu.
tasklist /fi "PID eq !pid!" /fo table /nh
choice /c EH /m "Bu islemi kapatip yenisini baslatayim mi? (E=evet, H=hayir)"
if errorlevel 2 (
  echo Iptal edildi. Port %1'i kullanan programi kapatip tekrar deneyin.
  exit /b 1
)
taskkill /pid !pid! /t /f >nul 2>&1
timeout /t 1 /nobreak >nul
exit /b 0

:fail
echo.
pause
exit /b 1

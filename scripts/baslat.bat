@echo off
chcp 65001 >nul
title teknemisatiyorum - uygulama + site
cd /d "%~dp0.."
set IP=
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet' -and $_.IPAddress -notmatch '^169' } | Select-Object -First 1).IPAddress"`) do set IP=%%i
echo.
echo  teknemisatiyorum aciliyor (veritabani, sunucu, uygulama, site)...
echo.
echo  Hazir olunca:
echo    Uygulama : Expo Go ile asagida cikan QR kodu okut
echo    Site     : bilgisayarda http://localhost:3001
echo               telefonda   http://%IP%:3001  (evdeki Wi-Fi)
echo    Telefonda uygulama adresi: exp://%IP%:8081
echo.
echo  Kapatmak icin bu pencerede Ctrl+C, sonra "E" ve Enter.
echo.
call npm run dev -- --web
echo.
echo  Sistem kapandi. Pencereyi kapatabilirsin.
pause >nul

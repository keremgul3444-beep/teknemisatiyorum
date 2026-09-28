@echo off
chcp 65001 >nul
title teknemisatiyorum - uygulama + site
cd /d "%~dp0.."
echo.
echo  teknemisatiyorum aciliyor (veritabani, sunucu, uygulama, site)...
echo.
echo  Hazir olunca:
echo    Uygulama : Expo Go ile asagida cikan QR kodu okut
echo    Site     : bilgisayarda http://localhost:3001
echo               telefonda   http://192.168.0.16:3001  (evdeki Wi-Fi)
echo.
echo  Kapatmak icin bu pencerede Ctrl+C, sonra "E" ve Enter.
echo.
call npm run dev -- --web
echo.
echo  Sistem kapandi. Pencereyi kapatabilirsin.
pause >nul

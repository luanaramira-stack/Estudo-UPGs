@echo off
chcp 65001 > nul
title Geoportal IMASUL / MS - Vazios de Monitoramento UPGs

echo =====================================================================
echo           GEOPORTAL IMASUL / MS - VAZIOS DE MONITORAMENTO
echo =====================================================================
echo.
echo Abrindo o Geoportal no seu navegador padrao...
echo.

set "GEOPORTAL_HTML=%~dp0index.html"

:: 1. Tenta abrir via servidor Python se disponivel (Python padrao do Windows ou QGIS)
where.exe python >nul 2>nul
if %errorlevel% equ 0 (
    echo Iniciando servidor local http://localhost:8080...
    start "" http://localhost:8080
    python -m http.server 8080
    exit /b
)

if exist "C:\Program Files\QGIS 3.44.11\bin\python-qgis-ltr.bat" (
    echo Iniciando servidor via QGIS Python http://localhost:8080...
    start "" http://localhost:8080
    "C:\Program Files\QGIS 3.44.11\bin\python-qgis-ltr.bat" -m http.server 8080
    exit /b
)

:: 2. Se nao houver Python, abre diretamente o HTML no navegador
echo Abrindo diretamente no navegador...
start "" "%GEOPORTAL_HTML%"

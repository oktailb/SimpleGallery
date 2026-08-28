@echo off
title Indra FFS - UDP Telemetry Bridge (50 Hz)
echo ======================================================================
echo    EC135 FFS - UDP Telemetry Bridge & Background Daemon
echo ======================================================================
echo.

cd /d "%~dp0"

set PHP_BIN=C:\xampp\php\php.exe
if not exist "%PHP_BIN%" (
    set PHP_BIN=php.exe
)

echo [*] Starting UDP Bridge with %PHP_BIN%...
"%PHP_BIN%" udp_bridge.php

pause

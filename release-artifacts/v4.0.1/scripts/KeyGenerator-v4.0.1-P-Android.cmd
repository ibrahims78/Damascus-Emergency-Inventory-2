@echo off
chcp 65001 >nul
title Damascus Emergency Inventory - License Key Generator
set "SCRIPT=%~dp0KeyGenerator-v4.0.1-P-Android.py"
set "PY="
where py >nul 2>nul && set "PY=py"
where python >nul 2>nul && if not defined PY set "PY=python"
if not defined PY (
  echo Python 3 is required. Install it from https://www.python.org/downloads/
  echo then run this file again.
  pause
  exit /b 1
)
%PY% "%SCRIPT%"
echo.
pause
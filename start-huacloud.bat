@echo off
title HuaCloud
cd /d "%~dp0"
echo ============================================
echo    HuaCloud - Kho anh ca nhan
echo ============================================
echo.
echo Dang khoi dong may chu... (lan dau hoi lau)
echo Trinh duyet se tu mo: http://localhost:3000
echo.
echo   * Giu cua so nay MO trong khi dung.
echo   * Dong cua so nay = TAT HuaCloud.
echo.
start "" http://localhost:3000
call npm run dev
pause

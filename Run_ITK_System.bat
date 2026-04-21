@echo off
title ITK School System Server
echo ==========================================
echo Starting Local Server for ITK School System...
echo ==========================================
echo.
echo Opening browser at http://localhost:8000...
start http://localhost:8000
echo.
echo [1] Trying Python Server...
python -m http.server 8000
if %errorlevel% neq 0 (
    echo Python not found, trying Node.js...
    npx serve . -l 8000
)
if %errorlevel% neq 0 (
    echo.
    echo Error: Could not start server. Please install "Live Server" in VS Code or ensure Node.js/Python is installed.
    pause
)
pause

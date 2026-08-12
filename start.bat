@echo off
cd /d "%~dp0"

echo Starting SimpleWorkFlow...
echo.

start "SimpleWorkFlow - Server (4000)" cmd /k "cd server && npm run dev"
timeout /t 3 /nobreak >nul

start "SimpleWorkFlow - Client (5173)" cmd /k "cd client && npm run dev"
timeout /t 3 /nobreak >nul

start "SimpleWorkFlow - Tunnel (share link)" cmd /k "npx --yes cloudflared tunnel --url http://localhost:5173"

echo.
echo Opened 3 windows: Server / Client / Tunnel.
echo  - Local only: http://localhost:5173
echo  - To share outside your network: check the "Tunnel" window for a
echo    https://....trycloudflare.com link and send that.
echo  - Keep these 3 windows open while using the app. Close them to stop.
echo.
pause

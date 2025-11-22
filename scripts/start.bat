@echo off
echo 🚀 Starting NeuroLens 3D...
echo.

REM Check if node_modules exist
if not exist "node_modules" (
    echo 📦 Installing backend dependencies...
    call npm install
)

if not exist "client\node_modules" (
    echo 📦 Installing frontend dependencies...
    cd client
    call npm install
    cd ..
)

echo.
echo ✅ Dependencies installed!
echo.
echo 🌐 Starting servers...
echo    Backend: http://localhost:3001
echo    Frontend: http://localhost:3000
echo.
echo Press Ctrl+C to stop
echo.

call npm run dev


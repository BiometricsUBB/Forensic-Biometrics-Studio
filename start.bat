@echo off

:: Check if Git is installed
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Git is not installed. Skipping git pull.
) else (
    :: Pull the latest changes from the currently checked-out branch
    echo Pulling the latest changes from the remote branch...
    git pull
    if %ERRORLEVEL% neq 0 (
        echo Failed to pull the latest changes. Please check your Git setup.
    )
)

:: Install dependencies using bun
echo Installing dependencies...
bun install
if %ERRORLEVEL% neq 0 (
    echo Dependency installation failed. Please check your bun setup.
    exit /b 1
)

:: Run Tauri development server
echo Starting Tauri development server...
bun run tauri dev
if %ERRORLEVEL% neq 0 (
    echo Failed to start Tauri development server. Please check your setup.
    exit /b 1
)

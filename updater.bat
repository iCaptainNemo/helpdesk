@echo off
where /q git
if ErrorLevel 1 (
    echo Git is not installed. Please install Git and rerun this script.
    pause
    exit /b
)

cd /d %~dp0

REM Add the current directory as a safe directory
git config --global --add safe.directory "%cd%"
if ErrorLevel 1 (
    echo Something bad happened...
    pause
    exit /b
)

if not exist .git (
    echo Initializing Git repository...
    git init
    if ErrorLevel 1 (
        echo Something bad happened...
        pause
        exit /b
    )
)

echo Pulling latest changes...
git pull https://github.com/iCaptainNemo/helpdesk.git
if ErrorLevel 1 (
    echo Something bad happened...
    pause
    exit /b
)
echo Success. Hit any key to close this window.
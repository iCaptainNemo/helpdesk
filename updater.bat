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

if not exist .git (
    echo Initializing Git repository...
    git init
    git remote add main https://github.com/iCaptainNemo/helpdesk.git
)

echo Pulling latest changes from origin/main...
git pull origin main
echo Success. Hit 
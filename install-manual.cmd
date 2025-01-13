@echo off
SETLOCAL EnableDelayedExpansion
color 0A

echo [92mChecking prerequisites...[0m

:: Check for Node.js
WHERE node >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo [91mNode.js not found. Please install Node.js first.[0m
    exit /b 1
)

:: Check if setupConfig exists, if not copy example
IF NOT EXIST setupConfig.js (
    echo [93mNo setupConfig.js found. Creating from example...[0m
    copy example_setupConfig.js setupConfig.js
    IF !ERRORLEVEL! NEQ 0 (
        echo [91mFailed to create setupConfig.js[0m
        exit /b 1
    )
    echo [92mCreated setupConfig.js successfully[0m
) ELSE (
    echo [92mFound existing setupConfig.js[0m
)

:: Install dependencies
echo [92mInstalling dependencies...[0m
cd Backend
call npm install
IF %ERRORLEVEL% NEQ 0 (
    echo [91mFailed to install backend dependencies[0m
    exit /b 1
)

cd ../frontend
call npm install
IF %ERRORLEVEL% NEQ 0 (
    echo [91mFailed to install frontend dependencies[0m
    exit /b 1
)
cd ..

:: Start setup wizard
echo [92mStarting setup wizard...[0m
cd Backend
start /B npm run start
cd ../frontend
start /B npm run start

echo [97m
echo =======================================
echo Setup wizard is now running!
echo Navigate to http://localhost:3000/setup
echo to complete configuration
echo =======================================
echo [0m

exit /b 0
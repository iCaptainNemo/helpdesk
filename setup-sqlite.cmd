@echo off
echo.
echo ====================================================================
echo  Helpdesk GUI - SQLite Setup (Optional but Recommended)
echo ====================================================================
echo.
echo The SQLite library enables database features like:
echo - Application logging and audit trails
echo - Server status history and persistence
echo - User action tracking
echo.
echo The application WILL WORK without SQLite, but these features will be disabled.
echo.

if not exist "lib" mkdir lib

echo Checking for System.Data.SQLite.dll...
if exist "lib\System.Data.SQLite.dll" (
    echo ✓ SQLite library already exists!
    echo   Location: lib\System.Data.SQLite.dll
    echo   All database features will be available.
    echo.
    pause
    exit /b 0
)

echo.
echo ⚠ SQLite library NOT FOUND
echo.
echo To enable full database functionality, please follow these steps:
echo.
echo 1. Go to: https://system.data.sqlite.org/index.html/doc/trunk/www/downloads.wiki
echo 2. Download "Precompiled Binaries for 64-bit Windows (.NET Framework 4.0)"
echo    - Look for: sqlite-netFx40-binary-x64-[version].zip
echo 3. Extract the zip file
echo 4. Copy "System.Data.SQLite.dll" to: %CD%\lib\
echo.
echo ALTERNATIVE: You can run the application now without SQLite
echo              Database features will be disabled but core AD functions will work.
echo.

set /p choice="Would you like to open the download page now? (y/n): "
if /i "%choice%"=="y" (
    start https://system.data.sqlite.org/index.html/doc/trunk/www/downloads.wiki
)

echo.
echo You can now run the application with:
echo    .\Start-HelpdeskGUI.ps1
echo.
echo If you skip SQLite setup:
echo - Core AD functions (search, unlock users) will work
echo - Database features (logging, server status) will be disabled
echo - You can add SQLite later and restart the app
echo.
pause

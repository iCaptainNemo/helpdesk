@echo off
setlocal
set "url=%1"
set "protocol=%url:jarvis:=%"
set "program=%protocol:~0,7%"
set "adObjectID=%protocol:~7%"

if "%program%"=="cmrcvie" (
    "C:\Program Files (x86)\Microsoft Endpoint Manager\AdminConsole\bin\i386\CmRcViewer.exe" %adObjectID%
) else if "%program%"=="msraaaa" (
    "C:\Windows\System32\msra.exe" /offerRA %adObjectID%
) else if "%program%"=="powersh" (
    powershell.exe -NoExit Enter-PSSession -ComputerName %adObjectID%
) else if "%program%"=="cmdexec" (
    cmd.exe /k "psexec.exe \\%adObjectID% cmd.exe"
) else (
    echo ========== Debug Info ==========
    echo Input URL: %url%
    echo Protocol: %protocol%
    echo Program: %program%
    echo Computer: %adObjectID%
    echo ==============================
    pause
)
endlocal
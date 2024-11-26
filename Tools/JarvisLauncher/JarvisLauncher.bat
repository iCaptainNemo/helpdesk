@echo off
setlocal
set "url=%1"
set "protocol=%url:jarvis:=%"
set "program=%protocol:~0,8%"
set "adObjectID=%protocol:~8%"

if "%program%"=="CmRcView" (
    "C:\Program Files (x86)\Microsoft Endpoint Manager\AdminConsole\bin\i386\CmRcViewer.exe" %adObjectID%
) else if "%program%"=="msra" (
    "C:\Windows\System32\msra.exe" /offerRA %adObjectID%
) else if "%program%"=="powershe" (
    powershell.exe %adObjectID%
) else if "%program%"=="cmd.exe" (
    cmd.exe /c %adObjectID%
) else (
    echo Unknown program: %program%
)
endlocal
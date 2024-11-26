@echo off
echo Adding registry keys for Jarvis custom protocol...

REM Add registry keys for Jarvis custom protocol
reg add "HKEY_CLASSES_ROOT\jarvis" /ve /d "URL:Jarvis Protocol" /f
reg add "HKEY_CLASSES_ROOT\jarvis" /v "URL Protocol" /d "" /f
reg add "HKEY_CLASSES_ROOT\jarvis\shell" /f
reg add "HKEY_CLASSES_ROOT\jarvis\shell\open" /f
reg add "HKEY_CLASSES_ROOT\jarvis\shell\open\command" /ve /d "\"C:\\Program Files\\JarvisLauncher\\JarvisLauncher.bat\" %%1" /f

echo Registry keys added successfully.
pause
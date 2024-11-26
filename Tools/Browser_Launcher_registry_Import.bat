@echo off
echo Adding registry keys for CmRcViewer and msra...

REM Add registry keys for CmRcViewer
reg add "HKEY_CLASSES_ROOT\CmRcViewer" /ve /d "CmRcViewer Protocol" /f
reg add "HKEY_CLASSES_ROOT\CmRcViewer" /v "URL Protocol" /d "" /f
reg add "HKEY_CLASSES_ROOT\CmRcViewer\shell" /f
reg add "HKEY_CLASSES_ROOT\CmRcViewer\shell\open" /f
reg add "HKEY_CLASSES_ROOT\CmRcViewer\shell\open\command" /ve /d "\"C:\\Program Files (x86)\\Microsoft Endpoint Manager\\AdminConsole\\bin\\i386\\CmRcViewer.exe\" %%1" /f

REM Add registry keys for msra
reg add "HKEY_CLASSES_ROOT\msra" /ve /d "msra Protocol" /f
reg add "HKEY_CLASSES_ROOT\msra" /v "URL Protocol" /d "" /f
reg add "HKEY_CLASSES_ROOT\msra\shell" /f
reg add "HKEY_CLASSES_ROOT\msra\shell\open" /f
reg add "HKEY_CLASSES_ROOT\msra\shell\open\command" /ve /d "\"C:\\Windows\\System32\\msra.exe\" %1" /f

echo Registry keys added successfully.
pause
; Helpdesk Jarvis NSIS Installer Script
; This installer provides a professional installation experience for helpdesk agents

;--------------------------------
; Includes

!include "MUI2.nsh"
!include "FileAssociation.nsh"
!include "x64.nsh"

;--------------------------------
; General Settings

; Application Information
!define APPNAME "Helpdesk Jarvis"
!define COMPANYNAME "IT Helpdesk Solutions"
!define DESCRIPTION "IT Helpdesk Management System"
!define VERSIONMAJOR 1
!define VERSIONMINOR 0
!define VERSIONBUILD 0
!define HELPURL "https://github.com/iCaptainNemo/helpdesk/issues"
!define UPDATEURL "https://github.com/iCaptainNemo/helpdesk/releases"
!define ABOUTURL "https://github.com/iCaptainNemo/helpdesk"
!define INSTALLSIZE 150000 ; Estimated size in KB

; Installer Configuration
Name "${APPNAME}"
OutFile "Helpdesk-Jarvis-Setup.exe"
InstallDir "$PROGRAMFILES64\\${APPNAME}"
InstallDirRegKey HKCU "Software\\${APPNAME}" ""
RequestExecutionLevel admin
ShowInstDetails show
ShowUnInstDetails show

; Version Information
VIProductVersion "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "CompanyName" "${COMPANYNAME}"
VIAddVersionKey "LegalCopyright" "© 2025 ${COMPANYNAME}"
VIAddVersionKey "FileDescription" "${DESCRIPTION}"
VIAddVersionKey "FileVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}"
VIAddVersionKey "ProductVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}"

;--------------------------------
; Interface Settings

!define MUI_ABORTWARNING
!define MUI_ICON "assets\\icon.ico"
!define MUI_UNICON "assets\\icon.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "assets\\header.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP "assets\\wizard.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "assets\\wizard.bmp"

; Custom colors and branding
!define MUI_BGCOLOR 0x667eea
!define MUI_TEXTCOLOR 0xFFFFFF

;--------------------------------
; Pages

; Installer pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "assets\\license.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY

; Custom page for deployment mode selection
Page custom DeploymentModePage DeploymentModePageLeave

!insertmacro MUI_PAGE_INSTFILES

; Custom page for initial setup
Page custom InitialSetupPage InitialSetupPageLeave

!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

;--------------------------------
; Languages

!insertmacro MUI_LANGUAGE "English"

;--------------------------------
; Custom Variables

Var DeploymentMode
Var AdminUsername
Var AdminPassword
Var RemoteServerUrl
Var ApiKey

;--------------------------------
; Installer Sections

Section "Core Application" SecCore
    SectionIn RO  ; Read-only section (always installed)
    
    SetOutPath "$INSTDIR"
    
    ; Install main application files
    File /r "..\\dist\\win-unpacked\\*.*"
    
    ; Create application data directories
    SetOutPath "$APPDATA\\${APPNAME}"
    CreateDirectory "$APPDATA\\${APPNAME}\\logs"
    CreateDirectory "$APPDATA\\${APPNAME}\\config"
    CreateDirectory "$APPDATA\\${APPNAME}\\database"
    
    ; Write registry keys
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "DisplayName" "${APPNAME}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "UninstallString" "$\"$INSTDIR\\uninstall.exe$\""
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "QuietUninstallString" "$\"$INSTDIR\\uninstall.exe$\" /S"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "InstallLocation" "$\"$INSTDIR$\""
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "DisplayIcon" "$\"$INSTDIR\\${APPNAME}.exe$\""
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "Publisher" "${COMPANYNAME}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "HelpLink" "${HELPURL}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "URLUpdateInfo" "${UPDATEURL}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "URLInfoAbout" "${ABOUTURL}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "DisplayVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}"
    WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "VersionMajor" ${VERSIONMAJOR}
    WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "VersionMinor" ${VERSIONMINOR}
    WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "NoModify" 1
    WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "NoRepair" 1
    WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "EstimatedSize" ${INSTALLSIZE}
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\\uninstall.exe"
    
SectionEnd

Section "Desktop Shortcut" SecDesktop
    CreateShortCut "$DESKTOP\\${APPNAME}.lnk" "$INSTDIR\\${APPNAME}.exe" "" "$INSTDIR\\${APPNAME}.exe" 0
SectionEnd

Section "Start Menu Shortcut" SecStartMenu
    CreateDirectory "$SMPROGRAMS\\${APPNAME}"
    CreateShortCut "$SMPROGRAMS\\${APPNAME}\\${APPNAME}.lnk" "$INSTDIR\\${APPNAME}.exe" "" "$INSTDIR\\${APPNAME}.exe" 0
    CreateShortCut "$SMPROGRAMS\\${APPNAME}\\Uninstall ${APPNAME}.lnk" "$INSTDIR\\uninstall.exe" "" "$INSTDIR\\uninstall.exe" 0
SectionEnd

Section "Auto-Start with Windows" SecAutoStart
    WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "${APPNAME}" "$INSTDIR\\${APPNAME}.exe"
SectionEnd

;--------------------------------
; Section Descriptions

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecCore} "Core application files (required)"
    !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} "Create a desktop shortcut for easy access"
    !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} "Add ${APPNAME} to the Start Menu"
    !insertmacro MUI_DESCRIPTION_TEXT ${SecAutoStart} "Automatically start ${APPNAME} when Windows starts"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

;--------------------------------
; Custom Pages

Function DeploymentModePage
    ; Custom page for deployment mode selection
    !insertmacro MUI_HEADER_TEXT "Deployment Configuration" "Choose your deployment mode"
    
    nsDialogs::Create 1018
    Pop $0
    
    ${NSD_CreateLabel} 20 20 360 20u "Select how you want to deploy Helpdesk Jarvis:"
    
    ${NSD_CreateRadioButton} 40 50 320 15u "&Local Mode - Run everything on this computer"
    Pop $1
    ${NSD_SetState} $1 ${BST_CHECKED}
    
    ${NSD_CreateRadioButton} 40 70 320 15u "&Remote Mode - Connect to a central server"
    Pop $2
    
    ${NSD_CreateLabel} 60 90 300 40u "Local Mode: Recommended for individual helpdesk agents. All data is stored locally and PowerShell scripts run on this computer."
    
    ${NSD_CreateLabel} 60 130 300 40u "Remote Mode: For teams using a central database server. Monitoring data is fetched remotely, but PowerShell scripts still run locally."
    
    nsDialogs::Show
FunctionEnd

Function DeploymentModePageLeave
    ${NSD_GetState} $1 $3
    ${If} $3 == ${BST_CHECKED}
        StrCpy $DeploymentMode "local"
    ${Else}
        StrCpy $DeploymentMode "remote"
    ${EndIf}
FunctionEnd

Function InitialSetupPage
    ; Custom page for initial application setup
    !insertmacro MUI_HEADER_TEXT "Initial Setup" "Configure your ${APPNAME} installation"
    
    ${If} $DeploymentMode == "local"
        ; Local mode setup
        nsDialogs::Create 1018
        Pop $0
        
        ${NSD_CreateLabel} 20 20 360 20u "Local Mode Setup:"
        ${NSD_CreateLabel} 20 50 120 15u "Admin Username:"
        ${NSD_CreateText} 150 48 200 15u "$USERNAME"
        Pop $3
        
        ${NSD_CreateLabel} 20 80 120 15u "Admin Password:"
        ${NSD_CreatePassword} 150 78 200 15u ""
        Pop $4
        
    ${Else}
        ; Remote mode setup
        nsDialogs::Create 1018
        Pop $0
        
        ${NSD_CreateLabel} 20 20 360 20u "Remote Mode Setup:"
        ${NSD_CreateLabel} 20 50 120 15u "Server URL:"
        ${NSD_CreateText} 150 48 200 15u "https://helpdesk.company.com"
        Pop $5
        
        ${NSD_CreateLabel} 20 80 120 15u "API Key:"
        ${NSD_CreatePassword} 150 78 200 15u ""
        Pop $6
    ${EndIf}
    
    nsDialogs::Show
FunctionEnd

Function InitialSetupPageLeave
    ${If} $DeploymentMode == "local"
        ${NSD_GetText} $3 $AdminUsername
        ${NSD_GetText} $4 $AdminPassword
    ${Else}
        ${NSD_GetText} $5 $RemoteServerUrl
        ${NSD_GetText} $6 $ApiKey
    ${EndIf}
    
    ; Write configuration file
    Call WriteInitialConfig
FunctionEnd

Function WriteInitialConfig
    ; Create initial configuration based on setup choices
    FileOpen $0 "$APPDATA\\${APPNAME}\\config\\initial-setup.json" w
    
    ${If} $DeploymentMode == "local"
        FileWrite $0 '{'
        FileWrite $0 '"mode": "local",'
        FileWrite $0 '"setupComplete": false,'
        FileWrite $0 '"adminUsername": "$AdminUsername",'
        FileWrite $0 '"timestamp": "'
        ${GetTime} "" "L" $1 $2 $3 $4 $5 $6 $7
        FileWrite $0 '$3-$2-$1 $5:$6:$7"'
        FileWrite $0 '}'
    ${Else}
        FileWrite $0 '{'
        FileWrite $0 '"mode": "remote",'
        FileWrite $0 '"setupComplete": false,'
        FileWrite $0 '"serverUrl": "$RemoteServerUrl",'
        FileWrite $0 '"timestamp": "'
        ${GetTime} "" "L" $1 $2 $3 $4 $5 $6 $7
        FileWrite $0 '$3-$2-$1 $5:$6:$7"'
        FileWrite $0 '}'
    ${EndIf}
    
    FileClose $0
FunctionEnd

;--------------------------------
; Installer Functions

Function .onInit
    ; Check for existing installation
    ReadRegStr $R0 HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}" "UninstallString"
    StrCmp $R0 "" done
    
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "${APPNAME} is already installed. $\n$\nClick OK to remove the previous version or Cancel to cancel this upgrade." IDOK uninst
    Abort
    
    uninst:
        ClearErrors
        ExecWait '$R0 _?=$INSTDIR'
        
        IfErrors no_remove_uninstaller done
        Delete $R0
        RMDir $INSTDIR
        
    no_remove_uninstaller:
    done:
    
    ; Check if we're on 64-bit Windows
    ${If} ${RunningX64}
        SetRegView 64
        StrCpy $INSTDIR "$PROGRAMFILES64\\${APPNAME}"
    ${Else}
        StrCpy $INSTDIR "$PROGRAMFILES\\${APPNAME}"
    ${EndIf}
    
FunctionEnd

Function .onInstSuccess
    ; Launch application after successful installation
    MessageBox MB_YESNO "Installation completed successfully! Would you like to launch ${APPNAME} now?" IDNO NoLaunch
    Exec "$INSTDIR\\${APPNAME}.exe"
    NoLaunch:
FunctionEnd

;--------------------------------
; Uninstaller Section

Section "Uninstall"
    ; Stop the application if running
    nsProcess::_FindProcess "${APPNAME}.exe"
    Pop $R0
    ${If} $R0 = 0
        MessageBox MB_YESNO "${APPNAME} is currently running. Do you want to close it and continue with uninstall?" IDYES KillApp IDNO AbortUninstall
        KillApp:
            nsProcess::_KillProcess "${APPNAME}.exe"
            Sleep 2000
        Goto ContinueUninstall
        AbortUninstall:
            Abort
    ${EndIf}
    
    ContinueUninstall:
    
    ; Remove files
    Delete "$INSTDIR\\${APPNAME}.exe"
    Delete "$INSTDIR\\uninstall.exe"
    RMDir /r "$INSTDIR"
    
    ; Remove shortcuts
    Delete "$DESKTOP\\${APPNAME}.lnk"
    Delete "$SMPROGRAMS\\${APPNAME}\\${APPNAME}.lnk"
    Delete "$SMPROGRAMS\\${APPNAME}\\Uninstall ${APPNAME}.lnk"
    RMDir "$SMPROGRAMS\\${APPNAME}"
    
    ; Remove auto-start registry entry
    DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "${APPNAME}"
    
    ; Remove application registry entries
    DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APPNAME}"
    DeleteRegKey HKCU "Software\\${APPNAME}"
    
    ; Ask about user data
    MessageBox MB_YESNO "Do you want to remove user data and configuration files?" IDNO KeepData
    RMDir /r "$APPDATA\\${APPNAME}"
    KeepData:
    
SectionEnd
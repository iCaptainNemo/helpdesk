<#
.SYNOPSIS
Creates an RDP shortcut for a specified computer after validating its existence in Active Directory.

.DESCRIPTION
This script first validates a computer name against Active Directory (AD) to check if it is part of the domain using the Get-ADComputer cmdlet. If the computer exists in the domain, it proceeds to create an RDP (Remote Desktop Protocol) shortcut on the desktop of the current user. If the computer is not found in AD, it notifies the user that the computer was not found.

.PARAMETER ComputerName
The name of the computer for which to create an RDP shortcut. This computer is validated against Active Directory to ensure it is part of the domain.

.EXAMPLE
.\Create-RDPShortcut.ps1 -ComputerName "Workstation01"
This example validates the existence of a computer named Workstation01 in Active Directory. If the computer exists, it creates an RDP shortcut on the user's desktop.

.NOTES
This script requires the Active Directory PowerShell module to be installed and available. It must be run with sufficient permissions to query Active Directory and to create shortcuts on the user's desktop.
#>

# Import ActiveDirectory module
Import-Module ActiveDirectory

function Validate-Username {
    param (
        [string]$Username
    )

    try {
        $User = Get-ADUser $Username -ErrorAction Stop
        Write-Host "User '$Username' Exists." -ForegroundColor Green
        return $true
    } catch {
        Write-Host "User '$Username' does not exist."  -ForegroundColor Red
        return $false
    }
}

# Validate Computer Name with AD
function Validate-ComputerName {
    param (
        [string]$ComputerName
    )

    # Check if the computer is part of the domain
    $computerInDomain = Get-ADComputer -Filter {Name -eq $ComputerName} -ErrorAction SilentlyContinue
    if ($computerInDomain) {
        Write-Host "Computer '$ComputerName' exists in AD."
        return $true
    } else {
        Write-Host "Computer '$ComputerName' not found in AD. Please try again."
        return $false
    }
}

$Username, $ComputerID, $RDPComputer = ''

cls

# Get user input for username
do {
    Write-Host "Enter User to create RDP Shortcut for:" -ForegroundColor Yellow
    $Username = Read-Host "Username"
} while (-not (Validate-Username -Username $Username))

# Get user input for computer name
do {
    $ComputerID = Read-Host "Enter a In-Office Computer name"
} while (-not (Validate-ComputerName -ComputerName $ComputerID))

# Get user input for remote computer name
do {
    $RDPComputer = Read-Host "Enter a Telecommuting computer name"
} while (-not (Validate-ComputerName -ComputerName $RDPComputer))


$outputdirectory = "\\$RDPComputer\c$\users\$Username\Desktop\"

$rdp = "
screen mode id:i:2
use multimon:i:1
desktopwidth:i:3440
desktopheight:i:1440
session bpp:i:32
winposstr:s:0,3,0,0,800,600
compression:i:1
keyboardhook:i:2
audiocapturemode:i:0
videoplaybackmode:i:1
connection type:i:7
networkautodetect:i:1
bandwidthautodetect:i:1
displayconnectionbar:i:1
enableworkspacereconnect:i:0
disable wallpaper:i:0
allow font smoothing:i:0
allow desktop composition:i:0
disable full window drag:i:1
disable menu anims:i:1
disable themes:i:0
disable cursor setting:i:0
bitmapcachepersistenable:i:1
full address:s:$ComputerID
audiomode:i:0
redirectprinters:i:1
redirectcomports:i:0
redirectsmartcards:i:1
redirectwebauthn:i:1
redirectclipboard:i:1
redirectposdevices:i:0
autoreconnection enabled:i:1
authentication level:i:0
prompt for credentials:i:0
negotiate security layer:i:1
remoteapplicationmode:i:0
alternate shell:s:
shell working directory:s:
gatewayhostname:s:
gatewayusagemethod:i:4
gatewaycredentialssource:i:4
gatewayprofileusagemethod:i:0
promptcredentialonce:i:0
gatewaybrokeringtype:i:0
use redirection server name:i:0
rdgiskdcproxy:i:0
kdcproxyname:s:
enablerdsaadauth:i:0
drivestoredirect:s:

" 

$rdp | Out-File -FilePath "$outputdirectory\Remote-DesktopV2.rdp"

Write-Host "`n Remote desktop icon has been created on $RDPComputer `n" -ForegroundColor DarkGreen -BackgroundColor White

Pause
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

function Get-UserADProperties {
    param (
        [string]$Username
    )
    $userProperties = Get-ADUser -Identity $Username -Properties HomeDirectory
    Write-Host "HomeShare: $($userProperties.HomeDirectory)"
    return $userProperties
}

function Create-Shortcut {
    param (
        [string]$RDPComputer,
        [string]$Username,
        [string]$ComputerID,
        [PSCustomObject]$userProperties # Assuming $userProperties includes a HomeDirectory property
    )

    # Ask the user for the location(s) to create the shortcut
    $locations = @("Desktop", "HomeDirectory")
    Write-Host "Select the location(s) to create the shortcut by entering the numbers separated by commas (e.g., 1,2):"
    for ($i = 0; $i -lt $locations.Length; $i++) {
        Write-Host "$($i+1): $($locations[$i])"
    }
    $selectedLocations = Read-Host "Enter your choice(s)"
    $selectedIndices = $selectedLocations.Split(',') | ForEach-Object { [int]$_ - 1 }

    # RDP file content
    $rdp = @"
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
username:s:hs\$Username
"@

    # Create the RDP file at the selected location(s)
    foreach ($index in $selectedIndices) {
        $location = $locations[$index]
        switch ($location) {
            "Desktop" {
                $outputDirectory = "\\$RDPComputer\c$\users\$Username\Desktop\"
                Write-Debug "Setting output directory to Desktop: $outputDirectory"
            }
            "HomeDirectory" {
                # Use the HomeDirectory from $userProperties and append \Desktop\ for the shortcut placement
                $outputDirectory = "$($User.HomeDirectory)\Desktop\"
                Write-Debug "Setting output directory to HomeDirectory: $outputDirectory"
            }
        }
    
        # Check if the output directory exists, if not, create it
        if (-not (Test-Path -Path $outputDirectory)) {
            Write-Debug "Output directory does not exist."
        }
    
        try {
            $rdp | Out-File -FilePath "$outputDirectory\Remote-DesktopV2.rdp"
            Write-Host "`nRemote desktop icon has been created on $RDPComputer in the $location.`n" -ForegroundColor Green
        } catch {
            Write-Error "Failed to create the RDP file."
        }
    }
}


$Username, $ComputerID, $RDPComputer = ''

cls

# Get user input for username
do {
    Write-Host "Enter User to create RDP Shortcut for:" -ForegroundColor Yellow
    $Username = Read-Host "Username"
} while (-not (Validate-Username -Username $Username))

do { 
    $User = Get-ADUser $Username -Properties HomeDirectory
    Write-Host "HomeShare: $($User.HomeDirectory)"
} while ($null -eq $User)

# Get user input for computer name
do {
    $ComputerID = Read-Host "Enter a In-Office Computer name"
} while (-not (Validate-ComputerName -ComputerName $ComputerID))

# Get user input for remote computer name
do {
    $RDPComputer = Read-Host "Enter a Telecommuting computer name"
} while (-not (Validate-ComputerName -ComputerName $RDPComputer))

# Create the RDP shortcut
Create-Shortcut -RDPComputer $RDPComputer -Username $Username -ComputerID $ComputerID

Pause
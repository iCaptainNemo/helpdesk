function Validate-Username {
    param (
        [string]$Username
    )

    try {
        $User = Get-ADUser $Username -ErrorAction Stop
        Write-Host "User '$Username' exists in AD."
        return $true
    } catch {
        Write-Host "User '$Username' not found in AD."
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

CLS
$UserID, $ComputerID, $RDPComputer = ''

Write-host "`n Before trying this script, make sure the user is on the County network In-Office or through VPN `n" -ForegroundColor Red -BackgroundColor White
Read-Host -Prompt "Press any key to continue..."


# Get user input for username
do {
    $UserID = Read-Host "Enter a username"
} while (-not (Validate-Username -Username $UserID))

# Get user input for computer name
do {
    $ComputerID = Read-Host "Enter a In-Office Computer name"
} while (-not (Validate-ComputerName -ComputerName $ComputerID))

# Get user input for remote computer name
do {
    $RDPComputer = Read-Host "Enter a Telecommuting computer name"
} while (-not (Validate-ComputerName -ComputerName $RDPComputer))


$outputdirectory = "\\$RDPComputer\c$\users\$UserID\Desktop\"

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

$rdp | Out-File -FilePath "$outputdirectory\RDPonVPN.rdp"

Write-Host "`n Remote desktop icon has been created on $RDPComputer `n" -ForegroundColor DarkGreen -BackgroundColor White

Read-Host -Prompt "Press any key to Finish..."
# Import necessary assemblies
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Import ActiveDirectory module
Import-Module ActiveDirectory

# Hide the console window
Add-Type -Name Window -Namespace Console -MemberDefinition '
[DllImport("Kernel32.dll")]
public static extern IntPtr GetConsoleWindow();

[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, Int32 nCmdShow);
'

$console = [Console.Window]::GetConsoleWindow()

# 0 hide
[Console.Window]::ShowWindow($console, 0) | Out-Null

# Start of script

function Validate-Username {
    param (
        [string]$Username
    )

    try {
        $User = Get-ADUser $Username -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Validate-ComputerName {
    param (
        [string]$ComputerName
    )

    $computerInDomain = Get-ADComputer -Filter {Name -eq $ComputerName} -ErrorAction SilentlyContinue
    if ($computerInDomain) {
        return $true
    } else {
        return $false
    }
}

function Create-Shortcut {
    param (
        [string]$RDPComputer,
        [string]$Username,
        [string]$ComputerID,
        [PSCustomObject]$userProperties,
        [string[]]$locations
    )

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
client:i:0
server authentication level:i:0
"@

    foreach ($location in $locations) {
        switch ($location) {
            "Desktop" {
                $outputDirectory = "\\$RDPComputer\c$\users\$Username\Desktop\"
            }
            "HomeDirectory" {
                $outputDirectory = "$($userProperties.HomeDirectory)\Desktop\"
            }
        }

        if (-not (Test-Path -Path $outputDirectory)) {
            New-Item -ItemType Directory -Path $outputDirectory -Force
        }

        try {
            $rdp | Out-File -FilePath "$outputDirectory\Remote-DesktopV2.rdp"
            [System.Windows.Forms.MessageBox]::Show("Remote desktop icon has been created on $RDPComputer in the $location.", "Success", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
        } catch {
            [System.Windows.Forms.MessageBox]::Show("Failed to create the RDP file.", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        }
    }
}

# Create the form
$form = New-Object System.Windows.Forms.Form
$form.Text = "Create RDP Shortcut"
$form.Size = New-Object System.Drawing.Size(400, 300)
$form.StartPosition = "CenterScreen"

# Create labels and textboxes for user input
$lblUsername = New-Object System.Windows.Forms.Label
$lblUsername.Text = "Username:"
$lblUsername.Location = New-Object System.Drawing.Point(10, 20)
$form.Controls.Add($lblUsername)

$txtUsername = New-Object System.Windows.Forms.TextBox
$txtUsername.Location = New-Object System.Drawing.Point(120, 20)
$txtUsername.Width = 250
$form.Controls.Add($txtUsername)

$lblComputerID = New-Object System.Windows.Forms.Label
$lblComputerID.Text = "In-Office Computer Name:"
$lblComputerID.Location = New-Object System.Drawing.Point(10, 60)
$form.Controls.Add($lblComputerID)

$txtComputerID = New-Object System.Windows.Forms.TextBox
$txtComputerID.Location = New-Object System.Drawing.Point(120, 60)
$txtComputerID.Width = 250
$form.Controls.Add($txtComputerID)

$lblRDPComputer = New-Object System.Windows.Forms.Label
$lblRDPComputer.Text = "Telecommuting Computer Name:"
$lblRDPComputer.Location = New-Object System.Drawing.Point(10, 100)
$form.Controls.Add($lblRDPComputer)

$txtRDPComputer = New-Object System.Windows.Forms.TextBox
$txtRDPComputer.Location = New-Object System.Drawing.Point(120, 100)
$txtRDPComputer.Width = 250
$form.Controls.Add($txtRDPComputer)

# Create checkboxes for Desktop and HomeDirectory
$chkDesktop = New-Object System.Windows.Forms.CheckBox
$chkDesktop.Text = "Desktop"
$chkDesktop.Location = New-Object System.Drawing.Point(120, 140)
$form.Controls.Add($chkDesktop)

$chkHomeDirectory = New-Object System.Windows.Forms.CheckBox
$chkHomeDirectory.Text = "Home Directory"
$chkHomeDirectory.Location = New-Object System.Drawing.Point(120, 170)
$form.Controls.Add($chkHomeDirectory)

# Create a button to validate and create the shortcut
$btnCreate = New-Object System.Windows.Forms.Button
$btnCreate.Text = "Create Shortcut"
$btnCreate.Location = New-Object System.Drawing.Point(150, 210)
$btnCreate.Size = New-Object System.Drawing.Size(120, 30)
$btnCreate.Add_Click({
    $Username = $txtUsername.Text
    $ComputerID = $txtComputerID.Text
    $RDPComputer = $txtRDPComputer.Text

    if (-not (Validate-Username -Username $Username)) {
        [System.Windows.Forms.MessageBox]::Show("User '$Username' does not exist.", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        return
    }

    $User = Get-ADUser $Username -Properties HomeDirectory
    if ($null -eq $User) {
        [System.Windows.Forms.MessageBox]::Show("Failed to retrieve user properties.", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        return
    }

    if (-not (Validate-ComputerName -ComputerName $ComputerID)) {
        [System.Windows.Forms.MessageBox]::Show("Computer '$ComputerID' not found in AD.", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        return
    }

    if (-not (Validate-ComputerName -ComputerName $RDPComputer)) {
        [System.Windows.Forms.MessageBox]::Show("Computer '$RDPComputer' not found in AD.", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        return
    }

    $locations = @()
    if ($chkDesktop.Checked) {
        $locations += "Desktop"
    }
    if ($chkHomeDirectory.Checked) {
        $locations += "HomeDirectory"
    }

    if ($locations.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show("Please select at least one location.", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        return
    }

    Create-Shortcut -RDPComputer $RDPComputer -Username $Username -ComputerID $ComputerID -userProperties $User -locations $locations

    # Clear input fields after successful creation
    $txtUsername.Clear()
    $txtComputerID.Clear()
    $txtRDPComputer.Clear()
    $chkDesktop.Checked = $false
    $chkHomeDirectory.Checked = $false
})

$form.Controls.Add($btnCreate)

# Show the form
[void]$form.ShowDialog()
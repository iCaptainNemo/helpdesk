# Import the Active Directory module to enable AD cmdlets
Import-Module ActiveDirectory

# Clear the console screen
Clear-Host

# Initialize variables
$UserID = ''
$ComputerID = ''
$Server = ''
$PrinterName = ''
$outputdirectory = ''

# Inform the user to ensure they are on the County network or connected through VPN
Write-Host "`n Before trying this script, make sure the user is on the County network In-Office or through VPN `n" -ForegroundColor Red -BackgroundColor White
Read-Host -Prompt "Press any key to continue..."
#Validate the printer in the Print server provided on Server variable
function Validate-PrinterOnServer {
    param (
        [string]$Server,          # The name of the print server
        [string]$PrinterName      # The name of the printer to validate
    )
    
    # Check if the Server is reachable
    if (-not (Test-Connection -ComputerName $Server -Count 1 -Quiet)) {
        Write-Host "The print server $Server is not reachable. Please check the server name and network connection." -ForegroundColor Red
        return $false
    }

    # Try to get the printer from the specified server
    try {
        $printers = Get-Printer -ComputerName $Server -ErrorAction Stop
        if ($printers.Name -contains $PrinterName) {
            Write-Host "The printer '$PrinterName' exists on the server '$Server'." -ForegroundColor Green
            return $true
        } else {
            Write-Host "The printer '$PrinterName' does not exist on the server '$Server'." -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "Failed to query printers on the server $Server. Error: $_" -ForegroundColor Red
        return $false
    }
}
# Function to validate UserID, ComputerID, and Server in Active Directory
function Get-ValidADInput {
    param (
        [string]$Prompt,                # Prompt message for user input
        [string]$ErrorMessage,          # Error message to display if validation fails
        [switch]$IsADUser = $false,    # Flag to specify if the input should be validated as an AD user
        [switch]$IsADComputer = $false, # Flag to specify if the input should be validated as an AD computer
        [switch]$IsNotEmpty = $false    # Flag to specify if the input should not be empty
    )
    while ($true) {
        # Read user input and trim any extra spaces
        $input = (Read-Host $Prompt).Trim()

        # Check if input should not be empty
        if ($IsNotEmpty -and [string]::IsNullOrWhiteSpace($input)) {
            Write-Host $ErrorMessage -ForegroundColor Red
            continue
        }

        # Validate as AD user if specified
        if ($IsADUser -and [string]::IsNullOrWhiteSpace($input) -eq $false) {
            try {
                $adUser = Get-ADUser -Identity $input -ErrorAction Stop
                if ($adUser) {
                    return $input
                }
            } catch {
                Write-Host $ErrorMessage -ForegroundColor Red
            }
            continue
        }

        # Validate as AD computer if specified
        if ($IsADComputer -and [string]::IsNullOrWhiteSpace($input) -eq $false) {
            try {
                $adComputer = Get-ADComputer -Identity $input -ErrorAction Stop
                if ($adComputer) {
                    return $input
                }
            } catch {
                Write-Host $ErrorMessage -ForegroundColor Red
            }
            continue
        }

        # If no AD validation needed, simply return the input
        return $input
    }
}

function Get-ValidPrinterName {
    param (
        [string]$Server,          # The name of the print server
        [string]$Prompt,          # Prompt message for user input
        [string]$ErrorMessage     # Error message to display if validation fails
    )
    while ($true) {
        # Read user input and trim any extra spaces
        $PrinterName = (Read-Host $Prompt).Trim()

        # Validate if printer name is not empty
        if ([string]::IsNullOrWhiteSpace($PrinterName)) {
            Write-Host $ErrorMessage -ForegroundColor Red
            continue
        }

        # Validate the printer on the server
        if (Validate-PrinterOnServer -Server $Server -PrinterName $PrinterName) {
            return $PrinterName
        } else {
            Write-Host $ErrorMessage -ForegroundColor Red
        }
    }
}


# Get valid UserID, ComputerID, and Server inputs
$UserID = Get-ValidADInput "Enter Employee ID" "The specified Employee ID does not exist in Active Directory. Please enter a valid Employee ID." -IsADUser -IsNotEmpty
$ComputerID = Get-ValidADInput "Enter a computer name" "The specified computer name does not exist in Active Directory. Please enter a valid computer name." -IsADComputer -IsNotEmpty

# Validate Server by checking if it's a valid computer object in AD
$Server = Get-ValidADInput "Enter Print server" "Print server cannot be empty. Please enter a valid print server." -IsADComputer -IsNotEmpty
$PrinterName = Get-ValidPrinterName -Server $Server -Prompt "Enter Printer name" -ErrorMessage "The specified printer does not exist on the server. Please enter a valid printer name."

# Construct the output directory path
$outputdirectory = "\\$ComputerID\c$\Users\$UserID\Desktop"

# Check if the output directory exists
if (-not (Test-Path $outputdirectory)) {
    Write-Host "The specified output directory does not exist: $outputdirectory" -ForegroundColor Red
    # Prompt the user to provide a different computer name if the directory is not found
    $continue = Read-Host "Do you want to provide a different computer name? (Y/N)"
    if ($continue -eq 'Y') {
        # Get a new computer name and re-check the output directory
        $ComputerID = Get-ValidADInput "Enter a computer name" "The specified computer name does not exist in Active Directory. Please enter a valid computer name." -IsADComputer -IsNotEmpty
        $outputdirectory = "\\$ComputerID\c$\Users\$UserID\Desktop"
        if (-not (Test-Path $outputdirectory)) {
            Write-Host "The specified output directory still does not exist: $outputdirectory" -ForegroundColor Red
            exit
        }
    } else {
        exit
    }
}

# Prepare batch script content to install printers
$ScriptContent = @"
@echo off
set PrintServer=$Server
set Printer=$PrinterName
set UserID=$UserID

REM Install printers for all users
for /d %%a in ("C:\Users\%UserID%") do (
    REM Add more printers as needed
    cscript C:\Windows\system32\Printing_Admin_Scripts\en-US\prnmngr.vbs -ac -p \\%PrintServer%\%Printer%
)

ECHO "Printer has been installed"
Pause

ECHO "This script will now self-destruct. Please ignore the next error message"
DEL "%~f0""
"@

# Write the batch script to the specified output file
$batFilePath = "$outputdirectory\AddPrinter.bat"
try {
    $ScriptContent | Out-File -FilePath $batFilePath -Encoding ASCII
    Write-Host "Batch file created successfully: $batFilePath" -ForegroundColor Green
} catch {
    # Handle any errors that occur while writing the batch file
    Write-Host "Failed to write the batch file to $outputdirectory. Error: $_" -ForegroundColor Red
}

# Pause the script to allow the user to see the final output
Pause

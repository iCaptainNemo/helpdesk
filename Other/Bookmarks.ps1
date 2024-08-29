# Import the Active Directory module
Import-Module ActiveDirectory

# Function to prompt for a valid computer name and validate its existence in AD
function Prompt-ForValidComputer {
    param (
        [string]$PromptMessage
    )
    do {
        $computerName = Read-Host $PromptMessage
        $computerExists = (Get-ADComputer -Filter { Name -eq $computerName } -ErrorAction SilentlyContinue) -ne $null
        if (-not $computerExists) {
            Write-Host "The computer '$computerName' does not exist in Active Directory. Please try again."
        }
    } while (-not $computerExists)
    return $computerName
}

# Function to prompt for a valid employee ID and validate its existence in AD
function Prompt-ForValidEmployeeID {
    do {
        $employeeID = Read-Host "Enter the EmployeeID"
        $userExists = (Get-ADUser -Filter { SamAccountName -eq $employeeID } -ErrorAction SilentlyContinue) -ne $null
        if (-not $userExists) {
            Write-Host "The Employee ID '$employeeID' does not exist in Active Directory. Please try again."
        }
    } while (-not $userExists)
    return $employeeID
}

# Function to prompt for a valid browser choice
function Prompt-ForValidBrowserChoice {
    do {
        $browserChoice = Read-Host "Choose the browser (1 for Chrome, 2 for Edge)"
        if ($browserChoice -notin @('1', '2')) {
            Write-Host "Invalid choice. Please enter 1 for Chrome or 2 for Edge."
        }
    } while ($browserChoice -notin @('1', '2'))
    return $browserChoice
}

# Prompt for and validate inputs
$sourceComputer = Prompt-ForValidComputer -PromptMessage "Enter the name of the source computer"
$destinationComputer = Prompt-ForValidComputer -PromptMessage "Enter the name of the destination computer"
$employeeID = Prompt-ForValidEmployeeID
$browserChoice = Prompt-ForValidBrowserChoice

# Define file paths based on the browser choice
switch ($browserChoice) {
    1 {
        $sourceFilePath = "\\$sourceComputer\C$\Users\$employeeID\AppData\Local\Google\Chrome\User Data\Default\Bookmarks"
        $destinationFilePath = "\\$destinationComputer\C$\Users\$employeeID\AppData\Local\Google\Chrome\User Data\Default\Bookmarks"
    }
    2 {
        $sourceFilePath = "\\$sourceComputer\C$\Users\$employeeID\AppData\Local\Microsoft\Edge\User Data\Default\Bookmarks"
        $destinationFilePath = "\\$destinationComputer\C$\Users\$employeeID\AppData\Local\Microsoft\Edge\User Data\Default\Bookmarks"
    }
}

# Define temporary local file path
$tempFilePath = "C:\Temp\Bookmarks"

# Ensure temp directory exists
if (-not (Test-Path "C:\Temp")) {
    New-Item -Path "C:\Temp" -ItemType Directory
}

# Copy the file from the source computer to local machine
Copy-Item -Path $sourceFilePath -Destination $tempFilePath -Force

# Copy the file from local machine to the destination computer
Copy-Item -Path $tempFilePath -Destination $destinationFilePath -Force

# Clean up temporary file
Remove-Item -Path $tempFilePath -Force

Write-Host "File transfer complete."
Pause
Clear-Host
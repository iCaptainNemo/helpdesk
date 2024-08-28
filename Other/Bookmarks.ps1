# Prompt for user inputs
$sourceComputer = Read-Host "Enter the name of the source computer"
$destinationComputer = Read-Host "Enter the name of the destination computer"
$employeeID = Read-Host "Enter the EmployeeID"
$browserChoice = Read-Host "Choose the browser (1 for Chrome, 2 for Edge)"

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
    default {
        Write-Host "Invalid choice. Please enter 1 for Chrome or 2 for Edge."
        exit
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
Clear-Host
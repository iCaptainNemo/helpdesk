# Function to add a network printer
function Add-NetworkPrinter {
    param (
        [string]$printServer,
        [string]$printerName
    )

    try {
        # Add the network printer using the Add-Printer cmdlet
        Add-Printer -ConnectionName "\\$printServer\$printerName"

        Write-Host "Network printer '$printerName' added successfully from print server '$printServer'" -ForegroundColor Green
    } catch {
        Write-Host "Error adding network printer: $_" -ForegroundColor Red
    }
}
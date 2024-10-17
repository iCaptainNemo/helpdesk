# Function to invoke SCCM remote tool
function Invoke-SCCMRemoteTool {
    param (
        [string]$computerName
    )

    # Check if the SCCM remote tool executable exists
    $sccmToolPath = "C:\Program Files (x86)\Microsoft Endpoint Manager\AdminConsole\bin\i386CmRcViewer.exe"

    if (Test-Path $sccmToolPath) {
        try {
            
            # Add a line break or additional Write-Host statements for space
            Write-Host "`n"

            # Invoke SCCM remote tool
            Start-Process -FilePath $sccmToolPath -ArgumentList "/server:$computerName" -Wait
            Write-Host "Launched SCCM Remote Tool for $computerName"
        } catch {
            Write-Host "Error launching SCCM Remote Tool: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "SCCM Remote Tool not found at $sccmToolPath" -ForegroundColor Red
    }
}

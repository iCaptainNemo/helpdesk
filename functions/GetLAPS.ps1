# Import the Active Directory module
Import-Module ActiveDirectory

function Get-LAPSPassword {
    param (
        [string]$computerName
    )
    try {
        $computer = Get-ADComputer $computerName -Properties "msLAPS-Password"
    
        # Check if the msLAPS-Password attribute exists
        if ($computer."msLAPS-Password") {
            Write-Host "The msLAPS-Password for computer '$computerName' is:" -ForegroundColor Green
            Write-Host $computer."msLAPS-Password" -ForegroundColor Yellow
        }
        else {
        Write-Host "The msLAPS-Password attribute is not set for the specified computer." -ForegroundColor Red
        }
    } 
    catch {
        # Catching the error and printing out more details for debugging
        Write-Host "Error retrieving LAPS password for $computerName : $_"
        return "Error retrieving LAPS password"
    }
}
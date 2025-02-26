# Import the Active Directory module
Import-Module ActiveDirectory
function Get-LAPSPassword {
    param (
        [string]$computerName
    )
    try {
        # Fetch the ms-Mcs-AdmPwd attribute explicitly for the computer object
        $computer = Get-ADComputer -Identity $computerName -Properties "ms-Mcs-AdmPwd"
        
        # Check if the ms-Mcs-AdmPwd attribute exists and is populated
        if ($computer.PSObject.Properties['ms-Mcs-AdmPwd']) {
            if ($computer.'ms-Mcs-AdmPwd') {
                return $computer.'ms-Mcs-AdmPwd'
            } else {
                return "LAPS password is empty or not set"
            }
        } else {
            return "ms-Mcs-AdmPwd attribute is not available"
        }
    } catch {
        # Catching the error and printing out more details for debugging
        Write-Host "Error retrieving LAPS password for $computerName : $_"
        return "Error retrieving LAPS password"
    }
}
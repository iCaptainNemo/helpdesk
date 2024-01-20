# Function to test connection to an asset
function Test-AssetConnection {
    param (
        [Parameter(Mandatory=$true)]
        [string]$ComputerName
    )

    try {
        $null = Test-Connection -ComputerName $ComputerName -Count 1 -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}
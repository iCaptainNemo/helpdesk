# Remove the 'UserID' key from the script environment variables (YAML system)
function Remove-UserId {
    param (
        [string]$AdminConfig  # Legacy parameter - not used in YAML system
    )

    # Clear the 'UserID' from the script environment variables
    $script:envVars['UserID'] = $null
    Write-Debug "UserID cleared from script environment variables"
}
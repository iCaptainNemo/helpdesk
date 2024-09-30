# Function to insert or update user in the Users table
function Manage-User {
    param (
        [string]$dbPath,
        [string]$userID
    )

    # Convert userID to uppercase
    $userID = $userID.ToUpper()

    # Retrieve AD object
    $adObject = .\functions\Get-ADObject.ps1 $userID

    if ($null -eq $adObject) {
        Write-Error "Failed to retrieve AD object for userID: $userID"
        return
    }

    # Convert and format DATETIME values
    $convertDateTime = {
        param ($fileTime)
        if ($fileTime -is [int64]) {
            if ($fileTime -eq 0 -or [datetime]::FromFileTimeUtc($fileTime).ToString("yyyy-MM-dd HH:mm:ss") -eq "1601-01-01 00:00:00") {
                return $null
            } else {
                return [datetime]::FromFileTimeUtc($fileTime).ToString("yyyy-MM-dd HH:mm:ss")
            }
        } elseif ($fileTime -is [datetime]) {
            return $fileTime.ToString("yyyy-MM-dd HH:mm:ss")
        } else {
            return $fileTime
        }
    }

    # Convert AD object fields
    $adObject.Created = $convertDateTime.Invoke($adObject.Created)
    $adObject.lastLogonTimestamp = $convertDateTime.Invoke($adObject.lastLogonTimestamp)
    $adObject.Modified = $convertDateTime.Invoke($adObject.Modified)
    $adObject.badPasswordTime = $convertDateTime.Invoke($adObject.badPasswordTime)
    $adObject.lockoutTime = if ($adObject.lockoutTime -eq 0) { $null } else { $convertDateTime.Invoke($adObject.lockoutTime) }
    $adObject.pwdLastSet = $convertDateTime.Invoke($adObject.pwdLastSet)

    # Extract relevant fields from AD object
    $fields = @{
        UserID = $adObject.SamAccountName
        badPwdCount = $adObject.badPwdCount
        City = $adObject.City
        department = $adObject.department
        givenName = $adObject.givenName
        homeDirectory = $adObject.homeDirectory
        mail = $adObject.mail
        sn = $adObject.sn
        streetAddress = $adObject.streetAddress
        telephoneNumber = $adObject.telephoneNumber
        Title = $adObject.title
        MemberOf = $adObject.MemberOf -join ", "
        Computers = $adObject.Computers
        # Custom fields
        LastHelped = $null
        TimesUnlocked = $null
        PasswordResets = $null
        # DateTime fields
        Created = $adObject.Created
        lastLogon = $adObject.lastLogonTimestamp
        Modified = $adObject.Modified
        badPasswordTime = $adObject.badPasswordTime
        lockoutTime = $adObject.lockoutTime
        pwdLastSet = $adObject.pwdLastSet
    }

    # Check if the user exists
    $fetchUserQuery = "SELECT * FROM Users WHERE UserID = '$userID';"
    $userRow = Invoke-SqliteQuery -DataSource $dbPath -Query $fetchUserQuery

    if ($userRow.Count -eq 0) {
        # Insert new user
        Write-Debug "Inserting new user '$userID' into the database."
        $columns = $fields.Keys -join ", "
        $values = $fields.Values.ForEach({ if ($_ -eq $null) { "NULL" } else { "'$_'" } }) -join ", "
        $insertUserQuery = "INSERT INTO Users ($columns) VALUES ($values);"

        try {
            Invoke-SqliteQuery -DataSource $dbPath -Query $insertUserQuery
            Write-Host "User '$userID' inserted into the database."
        } catch {
            Write-Error "Failed to insert user '$userID': $_"
        }
    } else {
        # Update existing user
        Write-Debug "User '$userID' already exists in the database. Checking for updated fields."

        # Compare and update only changed fields
        $currentValues = $userRow | Select-Object -First 1

        # Convert current database values to the same format as new values for comparison
        $currentValues.Created = [string]$convertDateTime.Invoke($currentValues.Created)
        $currentValues.lastLogon = [string]$convertDateTime.Invoke($currentValues.lastLogon)
        $currentValues.Modified = [string]$convertDateTime.Invoke($currentValues.Modified)
        $currentValues.badPasswordTime = [string]$convertDateTime.Invoke($currentValues.badPasswordTime)
        $currentValues.lockoutTime = [string]$convertDateTime.Invoke($currentValues.lockoutTime)
        $currentValues.pwdLastSet = [string]$convertDateTime.Invoke($currentValues.pwdLastSet)

        $changedFields = @{}
        foreach ($key in $fields.Keys) {
            $newValue = [string]$fields[$key]
            $oldValue = [string]$currentValues.$key

            # Skip updating if both old and new values are empty
            if (($newValue -eq $null -and $oldValue -eq $null) -or ($newValue -eq "" -and $oldValue -eq "")) {
                continue
            }

            if ($newValue -ne $oldValue) {
                $changedFields[$key] = $newValue
            }
        }

        if ($changedFields.Count -gt 0) {
            # Debugging: Print the fields that need to be updated along with their new and old values
            Write-Verbose "Fields to be updated:"
            $table = @()
            foreach ($key in $changedFields.Keys) {
                $table += [PSCustomObject]@{
                    Field = $key
                    Old   = $currentValues.$key
                    New   = $changedFields[$key]
                }
            }
            Write-Verbose ($table | Format-Table -AutoSize | Out-String)
        
            $setClause = ($changedFields.GetEnumerator() | ForEach-Object { 
                if ($_.Value -eq $null) { 
                    "$($_.Key) = NULL" 
                } else { 
                    "$($_.Key) = '$($_.Value)'" 
                } 
            }) -join ", "
            $updateUserQuery = "UPDATE Users SET $setClause WHERE UserID = '$userID';"
            try {
                Invoke-SqliteQuery -DataSource $dbPath -Query $updateUserQuery
                Write-Verbose "User '$userID' updated in the database."
            } catch {
                Write-Error "Failed to update user '$userID': $_"
            }
        } else {
            Write-Verbose "No changes detected for user '$userID'."
        }
    }
}

# Function to fetch user from the Users table
function Fetch-User {
    param (
        [string]$userID
    )
    
    # Use the global $dbPath variable
    $global:dbPath

    Write-Debug "Fetching user '$userID' from the database."

    # Always call Manage-User to ensure the user is inserted or updated
    Manage-User -dbPath $dbPath -userID $userID

    # Fetch the user row after Manage-User has run
    $fetchUserQuery = "SELECT * FROM Users WHERE UserID = '$userID';"
    $userRow = Invoke-SqliteQuery -DataSource $dbPath -Query $fetchUserQuery

    return $userRow
}
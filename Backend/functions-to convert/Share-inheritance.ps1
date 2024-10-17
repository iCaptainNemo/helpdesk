Set-ExecutionPolicy -ExecutionPolicy Undefined -Scope CurrentUser
Import-Module ActiveDirectory

function Get-FolderPath {
    do {
        $folderPath = Read-Host "Enter the full path of the network share folder (Q to quit)"
        if ($folderPath -eq "Q") {
            Write-Host "Exiting script."
            exit
        }
        if (-Not (Test-Path -Path $folderPath)) {
            Write-Host "Path does not exist. Try again (Q to quit)". -ForegroundColor Red
        }
    } while (-Not (Test-Path -Path $folderPath))
    return $folderPath
}

$folderPath = Get-FolderPath

# Get the ACL for the folder
$acl = Get-Acl -Path $folderPath

# Initialize an array to hold the permission objects
$permissionsList = @()

# Iterate through each access rule in the ACL
foreach ($accessRule in $acl.Access) {
    # Create a custom object for each rule
    $permissionObject = [PSCustomObject]@{
        "User/Group" = $accessRule.IdentityReference
        "Permissions" = $accessRule.FileSystemRights
        "Access Type" = $accessRule.AccessControlType
        "Inheritance" = if ($accessRule.IsInherited) { "Inherited" } else { "Not Inherited" }
    }

    # Add the object to the list
    $permissionsList += $permissionObject
}

# Display the permissions as a table
Write-Host ""
# Display the owner of the folder
$owner = $acl.Owner
Write-Host "Owner of the folder: $owner"
Write-Host "Current permissions for $folderPath"
Write-Host ""
$permissionsList | Format-Table -AutoSize

# Initialize a flag for controlling the loop
$continueEditing = $true

while ($continueEditing) {
    # Ask for the user/group to edit
    $selectedUser = Read-Host "Enter the User/Group that you want to edit ('Q' to exit)"

    # Check if the user wants to quit
    if ($selectedUser -eq 'Q') {
        Write-Host "Exiting script."
        break
    }

    # Find and display the selected user's permissions
    $selectedPermissions = $permissionsList | Where-Object { $_."User/Group" -eq $selectedUser }
    if ($selectedPermissions) {
        Write-Host "Current permissions for $selectedUser"
        $selectedPermissions | Format-Table -AutoSize

        # Define a list of permissions choices
        $permissionsChoices = @(
            "FullControl",
            "Modify",
            "ReadAndExecute",
            "ListDirectory",
            "Read",
            "Write"
        )

        # Display choices to the user
        Write-Host "Select the new permissions:"
        for ($i = 0; $i -lt $permissionsChoices.Length; $i++) {
            Write-Host "$($i+1): $($permissionsChoices[$i])"
        }

        # User makes a selection
        $selection = Read-Host "Enter the number for desired permission"
        if ($selection -lt 1 -or $selection -gt $permissionsChoices.Length) {
            Write-Host "Invalid selection. Please try again."
            continue
        }

        # Convert selection to permissions
        $newPermissions = $permissionsChoices[$selection - 1]

        # Ask for inheritance choice
        $inheritanceChoice = Read-Host "Should the permissions be inherited? (Y/N)"
        $inheritance = $inheritanceChoice -eq "Y"

        if ($inheritance -and $selectedUser -ne $owner) {
            Write-Host "Warning: User and Owner do not match, Inheritance will not work and must be applied to each file individually." -ForegroundColor Yellow
            $changeOwner = Read-Host "Change owner (y/n)"
            if ($changeOwner -eq 'y') {
                try {
                    # Change the owner of the folder and all subitems to the selected user
                    $newOwner = New-Object System.Security.Principal.NTAccount($selectedUser)
                    $acl.SetOwner($newOwner)
                    Get-ChildItem -Path $folderPath -Recurse | ForEach-Object {
                        try {
                            $itemAcl = Get-Acl $_.FullName
                            $itemAcl.SetOwner($newOwner)
                            Set-Acl -Path $_.FullName -AclObject $itemAcl
                        } catch [System.UnauthorizedAccessException] {
                            Write-Host "Needs elevated permissions to change ACL for $($_.FullName)." -ForegroundColor Red
                        } catch {
                            Write-Host "An error occurred: $($_.Exception.Message)" -ForegroundColor Red
                        }
                    }
                    Set-Acl -Path $folderPath -AclObject $acl
                    Write-Host "Owner changed to $selectedUser and permissions will be inherited."
                } catch [System.UnauthorizedAccessException] {
                    Write-Host "Needs elevated permissions to change folder owner." -ForegroundColor Red
                } catch {
                    Write-Host "An error occurred: $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        }

        # Create a new access rule
        $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule($selectedUser, $newPermissions, "ContainerInherit,ObjectInherit", "None", "Allow")

        # Remove existing access rules for the user
        $acl.Access | Where-Object { $_.IdentityReference -eq $selectedUser } | ForEach-Object { $acl.RemoveAccessRule($_) }

        # Add the new access rule
        $acl.SetAccessRule($accessRule)

        # Apply the changes
        Set-Acl -Path $folderPath -AclObject $acl

        Write-Host "Permissions updated for $selectedUser"

        # Ask if the user wants to edit another user/group or quit
        $editAnother = Read-Host "Edit permissions for another user/group? (yes/no)"
        if ($editAnother -ne 'yes') {
            Write-Host "Exiting script."
            break
        }
    } else {
        Write-Host "User/Group not found. Please try again or type 'quit' to exit."
        # The loop will continue, allowing the user to try again or quit
    }
}
Import-Module ActiveDirectory

function Get-DomainControllers {
    $dcList = @{ }
    try {
        $currentDomain = [System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()
        Write-Debug "Current Domain: $($currentDomain)"

        $currentDomain.DomainControllers | ForEach-Object {
            $dcList[$_.Name] = $_
        }

        # Retrieve the primary domain controller (PDC) emulator role owner DN
        $PDC = $currentDomain.PdcRoleOwner
        Write-Debug "Primary DC: $($PDC)"

        # Retrieve the distinguished name of the DDC
        $DDC = $currentDomain.RidRoleOwner
        Write-Debug "Distributed DC: $($DDC)"
        Write-Debug "Number of domain controllers found: $($dcList.Count)"

        return @{
            DcList = $dcList
            PDC = $PDC
            DDC = $DDC
        }
    } catch {
        Write-Host "Error: $_"
    }
}

$domainControllers = Get-DomainControllers
$PDC = $domainControllers.PDC

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Show-OptionsForm {
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Locked Out List Options"
    $form.Size = New-Object System.Drawing.Size(400, 300)
    $form.StartPosition = "CenterScreen"

    $userIDLabel = New-Object System.Windows.Forms.Label
    $userIDLabel.Text = "Enter User IDs (comma separated):"
    $userIDLabel.Location = New-Object System.Drawing.Point(10, 20)
    $userIDLabel.Size = New-Object System.Drawing.Size(200, 20)
    $form.Controls.Add($userIDLabel)

    $userIDTextBox = New-Object System.Windows.Forms.TextBox
    $userIDTextBox.Location = New-Object System.Drawing.Point(10, 50)
    $userIDTextBox.Size = New-Object System.Drawing.Size(360, 20)
    $form.Controls.Add($userIDTextBox)

    $refreshIntervalLabel = New-Object System.Windows.Forms.Label
    $refreshIntervalLabel.Text = "Select Refresh Interval (minutes):"
    $refreshIntervalLabel.Location = New-Object System.Drawing.Point(10, 80)
    $refreshIntervalLabel.Size = New-Object System.Drawing.Size(200, 20)
    $form.Controls.Add($refreshIntervalLabel)

    $refreshIntervalComboBox = New-Object System.Windows.Forms.ComboBox
    $refreshIntervalComboBox.Location = New-Object System.Drawing.Point(10, 110)
    $refreshIntervalComboBox.Size = New-Object System.Drawing.Size(360, 20)
    $refreshIntervalComboBox.Items.AddRange(2..10)
    $refreshIntervalComboBox.SelectedIndex = 0
    $form.Controls.Add($refreshIntervalComboBox)

    $autoUnlockCheckBox = New-Object System.Windows.Forms.CheckBox
    $autoUnlockCheckBox.Text = "Enable Auto Unlock for Mismatched Accounts"
    $autoUnlockCheckBox.Location = New-Object System.Drawing.Point(10, 140)
    $autoUnlockCheckBox.Size = New-Object System.Drawing.Size(300, 20)
    $form.Controls.Add($autoUnlockCheckBox)

    $startButton = New-Object System.Windows.Forms.Button
    $startButton.Text = "Start"
    $startButton.Location = New-Object System.Drawing.Point(10, 170)
    $startButton.Size = New-Object System.Drawing.Size(75, 23)
    $form.Controls.Add($startButton)

    $startButton.Add_Click({
        $watchedUserIDsInput = $userIDTextBox.Text
        $refreshInterval = [int]$refreshIntervalComboBox.SelectedItem
        $autoUnlock = $autoUnlockCheckBox.Checked

        $watchedUserIDsArray = $watchedUserIDsInput.Split(',')
        $watchedUserIDs = @{}
        foreach ($userID in $watchedUserIDsArray) {
            $watchedUserIDs[$userID.Trim()] = $true
        }

        $form.Close()
        Show-LockedOutUsersForm -watchedUserIDs $watchedUserIDs -refreshInterval $refreshInterval -autoUnlock $autoUnlock
    })

    $form.ShowDialog()
}

function Show-LockedOutUsersForm {
    param (
        $watchedUserIDs,
        $refreshInterval,
        $autoUnlock
    )

    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Locked Out Users"
    $form.Size = New-Object System.Drawing.Size(800, 600)
    $form.StartPosition = "CenterScreen"

    $dataGridView = New-Object System.Windows.Forms.DataGridView
    $dataGridView.Size = New-Object System.Drawing.Size(780, 500)
    $dataGridView.Location = New-Object System.Drawing.Point(10, 10)
    $dataGridView.ColumnCount = 3
    $dataGridView.Columns[0].Name = "User ID"
    $dataGridView.Columns[1].Name = "Name"
    $dataGridView.Columns[2].Name = "Lockout Time"

    $unlockButtonColumn = New-Object System.Windows.Forms.DataGridViewButtonColumn
    $unlockButtonColumn.Name = "Action"
    $unlockButtonColumn.Text = "Unlock"
    $unlockButtonColumn.UseColumnTextForButtonValue = $true
    $dataGridView.Columns.Add($unlockButtonColumn)

    $form.Controls.Add($dataGridView)

    function Refresh-LockedOutUsers {
        $dataGridView.Rows.Clear()
        
        # Set the AutoSizeColumnsMode to None
        $dataGridView.AutoSizeColumnsMode = [System.Windows.Forms.DataGridViewAutoSizeColumnsMode]::None
        
        # Adjust the width of each column
        $dataGridView.Columns[0].Width = 50  # SamAccountName
        $dataGridView.Columns[1].Width = 150  # Name
        $dataGridView.Columns[2].Width = 80   # AccountLockoutTime
        
        # Search for all locked-out user accounts
        $lockedOutUsers = Search-ADAccount -LockedOut -UsersOnly | Where-Object {
            $_.SamAccountName -notin $unlockable
        }
        
        # Initialize the list of watched locked-out users
        $watchedLockedOutUsers = @()
        
        # Iterate through all locked-out users and get additional AD properties
        $probableLockedOutUsers = foreach ($lockedOutUser in $lockedOutUsers) {
            $adUser = Get-ADUser -Identity $lockedOutUser.SamAccountName -Properties SamAccountName, Name, Enabled, LockedOut, Department, LastBadPasswordAttempt, AccountLockoutTime -Server $PDC
        
            # If the user is in the watched list, add them to the watched locked-out users list
            if ($watchedUserIDs.ContainsKey($adUser.SamAccountName)) {
                $watchedLockedOutUsers += $adUser
            }
        
            $adUser
        }
        
        # Filter locked-out users whose lockoutTime is within X days of the current date and Enabled is True
        $probableLockedOutUsers = $probableLockedOutUsers | Where-Object {
            $_.AccountlockoutTime -ge (Get-Date).AddDays(-1) -and
            $_.Enabled -eq $true
        }
        
        # Filter users whose AccountLockoutTime and LastBadPasswordAttempt do not match within a 5-minute interval
        # or if the LastBadPasswordAttempt is null
        $usersWithMismatchedTimes = $probableLockedOutUsers | Where-Object {
            if ($_.AccountLockoutTime) {
                if ($_.LastBadPasswordAttempt) {
                    return [Math]::Abs(($_.AccountLockoutTime - $_.LastBadPasswordAttempt).TotalMinutes) -gt 5
                } else {
                    return $true
                }
            }
            return $false
        }
        
        # Create a list of all locked out users that are not in $usersWithMismatchedTimes
        $lockedOut = $probableLockedOutUsers | Where-Object {
            $_.SamAccountName -notin $usersWithMismatchedTimes.SamAccountName
        }
        
        # Sort the locked-out users by AccountLockoutTime in descending order
        $lockedOut = $lockedOut | Sort-Object -Property AccountLockoutTime -Descending
        
        # Display the properties of locked-out users in the DataGridView
        $currentTime = Get-Date
        foreach ($user in $lockedOut) {
            $row = $dataGridView.Rows.Add()
            $dataGridView.Rows[$row].Cells[0].Value = $user.SamAccountName
            $dataGridView.Rows[$row].Cells[1].Value = $user.Name
            $dataGridView.Rows[$row].Cells[2].Value = $user.AccountLockoutTime.ToString("HH:mm:ss")
            
            # Highlight users locked out within the last 5 minutes in yellow
            $lockoutDuration = ($currentTime - $user.AccountLockoutTime).TotalMinutes
            if ($lockoutDuration -le 5) {
                $dataGridView.Rows[$row].DefaultCellStyle.BackColor = [System.Drawing.Color]::Yellow
            }
        }
        
        # Display the properties of watched locked-out users in a separate table
        if ($watchedLockedOutUsers.Count -gt 0) {
            Write-Host "Watched locked-out users within the last 24 hours: $($watchedLockedOutUsers.Count)" -ForegroundColor Red
            $tableOutput = $watchedLockedOutUsers | Sort-Object AccountLockoutTime -Descending | Format-Table @{Name='ID';Expression={$_.SamAccountName}}, Name, @{Name='Expired';Expression={$_.PasswordExpired}}, AccountLockoutTime -AutoSize | Out-String
            $tableOutput -split "`n" | ForEach-Object { Write-Host $_ -ForegroundColor Red }
        } else {
            Write-Host "0 watched locked-out users found." -ForegroundColor Green
        }
        
        # Display the properties of users with mismatched times in a separate table
        if ($usersWithMismatchedTimes.Count -gt 0) {
            Write-Host "Mismatched AccountLockoutTime and LastBadPasswordAttempt:" -ForegroundColor Yellow
            $usersWithMismatchedTimes | Sort-Object AccountLockoutTime -Descending | Format-Table @{Name='ID';Expression={$_.SamAccountName}}, Name, @{Name='Expired';Expression={$_.PasswordExpired}}, LastBadPasswordAttempt, AccountLockoutTime -AutoSize
        } else {
            Write-Host "0 users with mismatched found." -ForegroundColor Green
        }
    }    function Unlock-User {
        param (
            $userID,
            $targetDC,
            $dcList
        )
        .\Unlocker.ps1 -userId $userID -targetDC $targetDC -dcList $dcList -StopLoop:$true > $null
    }

    $dataGridView.add_CellContentClick({
        param ($sender, $e)
        if ($e.ColumnIndex -eq $dataGridView.Columns["Action"].Index -and $e.RowIndex -ge 0) {
            $userID = $dataGridView.Rows[$e.RowIndex].Cells[0].Value
            Unlock-User -userID $userID -targetDC $PDC -dcList $domainControllers.DcList
        }
    })

    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = $refreshInterval * 60 * 1000
    $timer.Add_Tick({ Refresh-LockedOutUsers })
    $timer.Start()
    Refresh-LockedOutUsers
    $form.ShowDialog()
}

Show-OptionsForm
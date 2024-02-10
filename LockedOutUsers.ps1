$Host.UI.RawUI.WindowTitle = Split-Path -Path $MyInvocation.MyCommand.Definition -Leaf
Import-Module ActiveDirectory

Function Show-Graph {
    [cmdletbinding()]
    [alias("Graph")]
    Param(
        [Parameter(Mandatory=$true)]
        [int[]] $Datapoints,
        [String] $XAxisTitle = 'X-Axis',
        [String] $YAxisTitle = 'Y Axis'
    )

    # Get the console window width
    $consoleWidth = $Host.UI.RawUI.BufferSize.Width

    # Limit the number of data points to the console window width
    if ($Datapoints.Count -gt $consoleWidth) {
        $Datapoints = $Datapoints | Select-Object -Last $consoleWidth
    }

    $NumOfDatapoints = $Datapoints.Count
    $NumOfLabelsOnYAxis = 10 # 50/5
    $XAxis = "   "+"-"*($NumOfDatapoints+3) 
    $YAxisTitleAlphabetCounter = 0
    $YAxisTitleStartIdx = 1
    $YAxisTitleEndIdx = $YAxisTitleStartIdx + $YAxisTitle.Length -1

    If($YAxisTitle.Length -gt $NumOfLabelsOnYAxis){
        Write-Warning "No. Alphabets in YAxisTitle [$($YAxisTitle.Length)] can't be greator than no. of Labels on Y-Axis [$NumOfLabelsOnYAxis]"
        Write-Warning "YAxisTitle will be cropped"
    }

    If($XAxisTitle.Length -gt $XAxis.length-3){
        $XAxisLabel = "   "+$XAxisTitle
    }else{
        $XAxisLabel = "   "+(" "*(($XAxis.Length – $XAxisTitle.Length)/2))+$XAxisTitle
    }

    # Create a 2D Array to save datapoints  in a 2D format
    $Array = New-Object 'object[,]' ($NumOfLabelsOnYAxis+1),$NumOfDatapoints
    $Count = 0
    $Datapoints | ForEach-Object {
        $r = [Math]::Floor($_/5) # 
        $Array[$r,$Count] = [char] 9608
        1..$R | ForEach-Object {$Array[$_,$Count] = [char] 9608}
        $Count++
    }

    # Draw graph
    For($i=10;$i -gt 0;$i–-){ 
        $Row = ''
        For($j=0;$j -lt $NumOfDatapoints;$j++){
            $Cell = $Array[$i,$j]
            $String = If([String]::IsNullOrWhiteSpace($Cell)){'  '}else{$Cell + ' '}
            $Row = [string]::Concat($Row,$String)          
        }
        
        $YAxisLabel = $i*5 
        
        # Condition to fix the spacing issue of a 3 digit vs 2 digit number [like 100 vs 90]  on the Y-Axis
        If("$YAxisLabel".length -lt 3){$YAxisLabel = (" "*(3-("$YAxisLabel".length)))+$YAxisLabel}
        
        If($i -in $YAxisTitleStartIdx..$YAxisTitleEndIdx){
            $YAxisLabelAlphabet = $YAxisTitle[$YAxisTitleAlphabetCounter]+" "
            $YAxisTitleAlphabetCounter++
        }
        else {
            $YAxisLabelAlphabet = '  '
        }

        # To color the graph depending upon the lockedOutUserCounts value
        If ($lockedOutUserCounts[$j] -lt 10) {
            Write-Host $YAxisLabelAlphabet -ForegroundColor DarkYellow -NoNewline
            Write-Host "$YAxisLabel|" -NoNewline
            Write-Host $Row -ForegroundColor DarkYellow
        }
        elseif ($lockedOutUserCounts[$j] -lt 20) {
            Write-Host $YAxisLabelAlphabet -ForegroundColor Yellow -NoNewline
            Write-Host "$YAxisLabel|" -NoNewline
            Write-Host $Row -ForegroundColor Yellow
        }
        elseif ($lockedOutUserCounts[$j] -lt 25) {
            Write-Host $YAxisLabelAlphabet -ForegroundColor DarkYellow -NoNewline
            Write-Host "$YAxisLabel|" -NoNewline
            Write-Host $Row -ForegroundColor DarkYellow
        }
        elseif($lockedOutUserCounts[$j] -lt 30) {
            Write-Host $YAxisLabelAlphabet -ForegroundColor DarkOrange -NoNewline
            Write-Host "$YAxisLabel|" -NoNewline
            Write-Host $Row -ForegroundColor DarkOrange
        }
        elseif($lockedOutUserCounts[$j] -ge 30) {
            Write-Host $YAxisLabelAlphabet -ForegroundColor Red -NoNewline
            Write-Host "$YAxisLabel|" -NoNewline
            Write-Host $Row -ForegroundColor Red
        }
        else {
            Write-Host "$YAxisLabel|"
        }
    }

    $XAxis # Prints X-Axis horizontal line
    Write-Host $XAxisLabel -ForegroundColor DarkYellow # Prints XAxisTitle
}

function Get-CurrentTime {
    Get-Date -Format "yyyy-MM-dd hh:mm:ss tt"
}

function Get-ProbableLockedOutUsers {
    # Search for all locked-out user accounts
    $lockedOutUsers = Search-ADAccount -LockedOut -UsersOnly

    # Iterate through all locked-out users and get additional AD properties
    $probableLockedOutUsers = foreach ($lockedOutUser in $lockedOutUsers) {
        Get-ADUser -Identity $lockedOutUser.SamAccountName -Properties *
    }
    # Filter locked-out users whose lockoutTime is within X days of the current date, Enabled is True, PasswordExpired is False, and badPwdCount is greater than 0
    $probableLockedOutUsers = $probableLockedOutUsers | Where-Object {
        $_.AccountlockoutTime -ge (Get-Date).AddDays(-1) -and
        $_.Enabled -eq $true
    }

    return $probableLockedOutUsers
}

# Get the current user
$AdminUser = Get-ADUser -Identity $env:USERNAME -Properties *

function Display-RestartCount {
    $script:restartCount++
    Write-Host "Script has restarted $($script:restartCount) times."
}

# Prompt user for refresh interval
do {
    $refreshInterval = Read-Host "Enter the refresh interval in minutes (e.g., 1, 5, 10):"
    $refreshInterval = [int]$refreshInterval
} while ($refreshInterval -le 0)

# Initialize restart count
$script:restartCount = 0

# Initialize an array to store the count of locked-out users at each refresh interval
$lockedOutUserCounts = @()

do {
    # Clear the host
    Clear-Host

    # Display the current time
    $currentTime = Get-CurrentTime
    #Write-Host "Current Time: $currentTime"

    # Display the restart count
    Display-RestartCount

    # Get probable locked-out users
    $probableLockedOutUsers = Get-ProbableLockedOutUsers

    # Add the count of locked-out users to the array
    $lockedOutUserCounts += $probableLockedOutUsers.Count

    # Calculate the number of data points to keep based on the refresh interval
    $dataPointsToKeep = 180 / $refreshInterval

    # Keep only the last $dataPointsToKeep data points
    if ($lockedOutUserCounts.Count -gt $dataPointsToKeep) {
        $lockedOutUserCounts = $lockedOutUserCounts | Select-Object -Last $dataPointsToKeep
    }

    # Display the number of probable locked-out users
    if ($probableLockedOutUsers.Count -gt 0) {
       ### Write-Host "Number of locked-out users: $($probableLockedOutUsers.Count)" -ForegroundColor Red
    } else {
        ### Write-Host "Number of locked-out users: 0" -ForegroundColor Green
    }

    # Users who are locked out and password is expired
    $lockedoutusersB = $probableLockedOutUsers | Where-Object {
        $_.PasswordExpired -eq $true
    }

    # The rest of the users
    $lockedoutusersA = $probableLockedOutUsers | Where-Object {
        $_ -notin $lockedoutusersB
    }

    # Display the properties of users in $lockedoutusersA and $lockedoutusersB in separate tables
    if ($lockedoutusersA.Count -gt 0) {
       ### Write-Host "Locked-out users within the last 24 hours:"
        ### $lockedoutusersA | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, AccountLockoutTime -AutoSize
    }
    if ($lockedoutusersB.Count -gt 0) {
       ### Write-Host "Locked-out users Password Expired within the last 24 hours:"
       ###  $lockedoutusersB | Sort-Object AccountLockoutTime -Descending | Format-Table -Property SamAccountName, Name, AccountLockoutTime -AutoSize
    }

    # Display the graph
    Show-Graph -Datapoints $lockedOutUserCounts -XAxisTitle "$(Get-Date -Format "hh:mm tt")" -YAxisTitle "$($probableLockedOutUsers.Count)"

    # Display the countdown message
    Write-Host "Refreshing in $refreshInterval $(if($refreshInterval -eq 1){"minute"}else{"minutes"})"

    # Wait for specified minutes
    Start-Sleep -Seconds ($refreshInterval * 60)

    #$Datapoints = (1..50|Get-Random -Count 50)
    #Show-Graph -Datapoints $Datapoints -XAxisTitle "Avg. CPU utilization" -YAxisTitle "Percentage"

} while ($true)
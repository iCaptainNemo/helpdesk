# hello-world.ps1

# Define a message object
$messageObject = @{
    message = "Hello, World!"
}

# Convert the object to JSON and output it
$jsonOutput = $messageObject | ConvertTo-Json -Compress
Write-Output $jsonOutput
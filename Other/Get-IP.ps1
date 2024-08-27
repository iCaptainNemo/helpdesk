
# Get the DNS resolvers of the local computer
$dnsResolvers = Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object -ExpandProperty ServerAddresses

# Print the DNS resolvers
Write-Host "DNS Resolvers:"
$dnsResolvers | ForEach-Object { Write-Host $_ }

# Loop to ask for network computer and resolve IPs
do {
    # Ask for a network computer to resolve
    $networkComputer = Read-Host "Enter the network computer to resolve"

    # Resolve the network computer using each DNS resolver
    foreach ($dnsResolver in $dnsResolvers) {
        Write-Host "Resolving $networkComputer using DNS resolver $dnsResolver..."
        try {
            $resolvedIPs = Resolve-DnsName -Name $networkComputer -Server $dnsResolver -ErrorAction Stop | Select-Object -ExpandProperty IPAddress
            Write-Host "Resolved IP addresses of $networkComputer using DNS resolver $dnsResolver :"
            $resolvedIPs | ForEach-Object { Write-Host $_ -ForegroundColor Green }
        } catch {
            Write-Host "Failed to resolve $networkComputer using DNS resolver $dnsResolver"
        }
    }

    # Pause to allow user to copy the IP addresses
    pause
    cls

} while ($true)
<#
.SYNOPSIS
    Active Directory properties configuration loader
.DESCRIPTION
    Loads AD properties configuration from YAML file. Returns property lists
    optimized for both PowerShell AD module and DirectorySearcher (WMI fallback).
    Provides centralized property management to avoid hardcoded properties.
.FUNCTIONALITY
    - Loads AD properties from YAML configuration file
    - Returns optimized property lists for different query types
    - Supports both PowerShell AD and DirectorySearcher methods
    - Provides fallback defaults if configuration file is missing
    - Maps property names between PowerShell AD and DirectorySearcher formats
.EXAMPLE
    $adConfig = Get-ADPropertiesConfig
    $userProperties = Get-ADUserProperties -Properties $adConfig.PowerShellAD.UserProperties.All
.NOTES
    Author: Helpdesk Team
    Version: 2.0
    Requires: YAML configuration file at Config/ADProperties.yaml
    Part of: Jarvis Helpdesk Automation System - Core Functions
#>

function Get-ADPropertiesConfig {
    [CmdletBinding()]
    param()
    
    $configPath = Join-Path $PSScriptRoot "..\..\Config\ADProperties.yaml"
    Write-Debug "Loading AD Properties config from: $configPath"
    
    # Check if configuration file exists
    if (-not (Test-Path $configPath)) {
        Write-Warning "AD Properties configuration not found: $configPath"
        Write-Debug "Using fallback default properties"
        
        # Return fallback default configuration
        return @{
            PowerShellAD = @{
                UserProperties = @{
                    UseAllProperties = $true
                    Core = @("SamAccountName", "DisplayName", "DistinguishedName", "MemberOf", "Enabled")
                    Extended = @("HomeDirectory", "Department", "telephoneNumber", "AccountLockoutTime", "LastBadPasswordAttempt", "BadLogonCount", "badPwdCount", "PasswordExpired", "PasswordLastSet", "LastLogonDate")
                    All = "*"
                }
                ComputerProperties = @{
                    Core = @("Name", "DistinguishedName", "DNSHostName", "OperatingSystem", "LastLogonDate", "Enabled")
                }
                ObjectProperties = @{
                    General = @("Name", "ObjectClass", "DistinguishedName", "ObjectGUID")
                    BitLocker = @("msFVE-RecoveryPassword", "whenCreated")
                }
            }
            DirectorySearcher = @{
                UserProperties = @{
                    Core = @("cn", "distinguishedName", "displayName", "givenName", "sn", "userPrincipalName", "mail", "memberOf", "sAMAccountName")
                    Extended = @("lockoutTime", "pwdLastSet", "userAccountControl", "homeDirectory", "department", "telephoneNumber", "badPwdCount", "badPasswordTime", "lastLogon")
                    All = @("cn", "distinguishedName", "displayName", "givenName", "sn", "userPrincipalName", "mail", "memberOf", "sAMAccountName", "lockoutTime", "pwdLastSet", "userAccountControl", "homeDirectory", "department", "telephoneNumber", "badPwdCount", "badPasswordTime", "lastLogon", "objectGUID")
                }
                ComputerProperties = @{
                    Core = @("cn", "distinguishedName", "dNSHostName", "operatingSystem", "lastLogon", "userAccountControl", "sAMAccountName")
                }
            }
            PropertyMapping = @{
                SamAccountName = "sAMAccountName"
                DisplayName = "displayName"
                GivenName = "givenName"
                Surname = "sn"
                UserPrincipalName = "userPrincipalName"
                EmailAddress = "mail"
                DistinguishedName = "distinguishedName"
                HomeDirectory = "homeDirectory"
                Department = "department"
                telephoneNumber = "telephoneNumber"
                DNSHostName = "dNSHostName"
                OperatingSystem = "operatingSystem"
            }
        }
    }
    
    try {
        $adPropsConfig = Get-Content $configPath -Raw | ConvertFrom-Yaml
        Write-Debug "AD Properties configuration loaded successfully"
        
        # Process the configuration to create convenience properties
        $processedConfig = $adPropsConfig
        
        # Add "All" property lists by combining Core and Extended
        if ($adPropsConfig.PowerShellAD.UserProperties.UseAllProperties -eq $true) {
            $processedConfig.PowerShellAD.UserProperties.All = "*"
        } else {
            $allPSUserProperties = @()
            $allPSUserProperties += $adPropsConfig.PowerShellAD.UserProperties.Core
            $allPSUserProperties += $adPropsConfig.PowerShellAD.UserProperties.Extended
            $processedConfig.PowerShellAD.UserProperties.All = $allPSUserProperties
        }
        
        # Combine DirectorySearcher properties
        $allDSUserProperties = @()
        $allDSUserProperties += $adPropsConfig.DirectorySearcher.UserProperties.Core
        $allDSUserProperties += $adPropsConfig.DirectorySearcher.UserProperties.Extended
        $processedConfig.DirectorySearcher.UserProperties.All = $allDSUserProperties
        
        return $processedConfig
        
    } catch {
        Write-Error "Failed to load AD Properties configuration: $($_.Exception.Message)"
        Write-Warning "Using fallback default properties"
        
        # Return fallback configuration on error
        return @{
            PowerShellAD = @{
                UserProperties = @{
                    UseAllProperties = $true
                    Core = @("SamAccountName", "DisplayName", "DistinguishedName", "MemberOf", "Enabled")
                    Extended = @("HomeDirectory", "Department", "telephoneNumber", "AccountLockoutTime", "LastBadPasswordAttempt", "BadLogonCount", "badPwdCount", "PasswordExpired", "PasswordLastSet", "LastLogonDate")
                    All = "*"
                }
                ComputerProperties = @{
                    Core = @("Name", "DistinguishedName", "DNSHostName", "OperatingSystem", "LastLogonDate", "Enabled")
                }
                ObjectProperties = @{
                    General = @("Name", "ObjectClass", "DistinguishedName", "ObjectGUID")
                    BitLocker = @("msFVE-RecoveryPassword", "whenCreated")
                }
            }
            DirectorySearcher = @{
                UserProperties = @{
                    Core = @("cn", "distinguishedName", "displayName", "givenName", "sn", "userPrincipalName", "mail", "memberOf", "sAMAccountName")
                    Extended = @("lockoutTime", "pwdLastSet", "userAccountControl", "homeDirectory", "department", "telephoneNumber", "badPwdCount", "badPasswordTime", "lastLogon")
                    All = @("cn", "distinguishedName", "displayName", "givenName", "sn", "userPrincipalName", "mail", "memberOf", "sAMAccountName", "lockoutTime", "pwdLastSet", "userAccountControl", "homeDirectory", "department", "telephoneNumber", "badPwdCount", "badPasswordTime", "lastLogon", "objectGUID")
                }
                ComputerProperties = @{
                    Core = @("cn", "distinguishedName", "dNSHostName", "operatingSystem", "lastLogon", "userAccountControl", "sAMAccountName")
                }
            }
            PropertyMapping = @{
                SamAccountName = "sAMAccountName"
                DisplayName = "displayName"
                GivenName = "givenName"
                Surname = "sn"
                UserPrincipalName = "userPrincipalName"
                EmailAddress = "mail"
                DistinguishedName = "distinguishedName"
                HomeDirectory = "homeDirectory"
                Department = "department"
                telephoneNumber = "telephoneNumber"
                DNSHostName = "dNSHostName"
                OperatingSystem = "operatingSystem"
            }
        }
    }
}
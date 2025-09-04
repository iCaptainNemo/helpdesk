# Jarvis Helpdesk - Developer Documentation

## Overview
This document provides comprehensive instructions for modifying, extending, and maintaining the Jarvis helpdesk automation system. The system uses a modular architecture with YAML-driven configuration for maximum flexibility.

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Adding Asset Control Features](#adding-asset-control-features)
3. [Modifying Existing Functions](#modifying-existing-functions)
4. [Configuration Management](#configuration-management)
5. [Adding New Menu Systems](#adding-new-menu-systems)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## System Architecture

### Folder Structure
```
helpdesk/
├── jarvis.ps1                    # Main entry point
├── Functions/                    # Organized function library
│   ├── Core/                    # System core functions (loaded by jarvis)
│   ├── UserManagement/          # User account operations (loaded by jarvis)
│   ├── AssetControl/           # Asset management features (loaded by jarvis)
│   ├── Utilities/              # Shared utility functions (loaded by jarvis)
│   └── Standalone/             # ⚠️ STANDALONE SCRIPTS - NOT loaded by jarvis
├── Config/                      # YAML configuration files
├── Templates/                   # YAML templates
├── Tools/                      # External executables
└── Other/                      # Miscellaneous scripts
```

### Key Components
- **jarvis.ps1**: Main aggregator that loads all functions and manages configuration
- **YAML Configuration**: Drives menu systems and feature availability
- **Modular Functions**: Organized by purpose for easier maintenance
- **Template System**: Enables easy creation of new configurations
- **Standalone Scripts**: Independent scripts in `Functions/Standalone/` that run separately

## Adding Asset Control Features

### Quick Start Guide
Adding a new Asset Control feature requires **NO PowerShell code changes** to the main system - only YAML configuration updates!

### Step 1: Create the Feature Function
Create a new PowerShell file in `Functions/AssetControl/`:

```powershell
# Functions/AssetControl/my-new-feature.ps1

<#
.SYNOPSIS
    Brief description of what this feature does
.DESCRIPTION
    Detailed description of the functionality
.PARAMETER userId
    The user ID for context
.PARAMETER computerName
    The target computer name
.EXAMPLE
    My-NewFeature -userId "jdoe" -computerName "COMPUTER01"
#>
function My-NewFeature {
    param (
        [Parameter(Mandatory=$true)]
        [string]$userId,
        
        [Parameter(Mandatory=$false)]
        [string]$computerName
    )
    
    Write-Debug "Starting My-NewFeature for user: $userId"
    
    try {
        # Your feature implementation here
        Write-Host "Executing new feature for $userId" -ForegroundColor Green
        
        # Example: Get computer information
        if ($computerName) {
            $computer = Get-ADComputer -Identity $computerName -Properties *
            Write-Host "Computer: $($computer.Name)" -ForegroundColor Cyan
        }
        
        Read-Host "Press Enter to continue"
        
    } catch {
        Write-Error "Failed to execute feature: $($_.Exception.Message)"
        Write-Debug "Exception details: $($_.Exception)"
        Read-Host "Press Enter to continue"
    }
}
```

### Step 2: Add to Menu Configuration
Edit `Config/AssetControlMenu.yaml` and add your feature:

```yaml
menu:
  title: "Asset Control Options"
  items:
    # ... existing items ...
    - id: 5                           # Next available number
      name: "My New Feature"          # Display name in menu
      function: "My-NewFeature"       # Exact function name
      module: "my-new-feature"        # Filename without .ps1
      description: "Does something awesome"
      enabled: true                   # Set to false to disable
```

### Step 3: Test Your Feature
1. Start jarvis.ps1
2. Navigate to Asset Control menu
3. Your new feature should appear automatically
4. Test functionality and error handling

**That's it!** No changes to jarvis.ps1, Main-Loop.ps1, or any other core files needed.

## Modifying Existing Functions

### Editing Asset Control Features
1. Locate the function file in `Functions/AssetControl/`
2. Make your changes following PowerShell best practices
3. Test thoroughly before deployment

### Editing Core Functions
⚠️ **Warning**: Core functions affect system stability. Test extensively!

1. Functions in `Functions/Core/` handle critical system operations
2. Always maintain backward compatibility
3. Use `Write-Debug` for troubleshooting output
4. Update function documentation if behavior changes

### Function Documentation Standards
Always use proper PowerShell documentation:

```powershell
<#
.SYNOPSIS
    Brief one-line description
.DESCRIPTION
    Detailed description of what the function does
    Include any important behavior notes
.PARAMETER ParameterName
    Description of what this parameter does
.EXAMPLE
    Function-Name -Parameter "value"
    Description of what this example demonstrates
.NOTES
    Author: Your Name
    Version: 1.0
    Last Modified: Date
#>
function Function-Name {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true, HelpMessage="Description")]
        [string]$ParameterName
    )
    
    Write-Debug "Function started with parameter: $ParameterName"
    
    # Function implementation
}
```

## Configuration Management

### YAML Configuration Files

#### AssetControlMenu.yaml Structure
```yaml
menu:
  title: "Asset Control Options"           # Menu header text
  items:                                   # List of menu items
    - id: 1                               # Unique identifier (integer)
      name: "Display Name"                # Text shown in menu
      function: "Function-Name"           # PowerShell function to call
      module: "filename-without-ps1"      # File in AssetControl folder
      description: "What this does"       # Help text
      enabled: true                       # true/false to show/hide
```

#### Domain Configuration Files
- `domain_[domain-name].yaml`: Domain-specific settings
- `admin_[username].yaml`: User-specific settings
- Follow existing template patterns in `Templates/` folder

### Creating New Configurations
1. Copy appropriate template from `Templates/`
2. Replace placeholders (marked with `<PLACEHOLDER>`)
3. Save to `Config/` folder with proper naming convention
4. Test configuration loading

## Working with Standalone Scripts

### Important: Standalone vs Integrated Functions

**Standalone Scripts** (`Functions/Standalone/`):
- ❌ **NOT loaded by jarvis.ps1**
- ❌ **NOT accessible from Asset Control menu**
- ✅ **Run independently** with their own parameters
- ✅ **Complete, self-contained scripts**
- ✅ **Can have immediate execution code**

**Integrated Functions** (`Functions/Core/`, `Functions/AssetControl/`, etc.):
- ✅ **Loaded by jarvis.ps1**
- ✅ **Accessible through menu systems**
- ❌ **Must be function definitions only**
- ❌ **Cannot have immediate execution code**

### Running Standalone Scripts
```powershell
# Run standalone scripts directly
.\Functions\Standalone\Get-ServerStatus.ps1 -Debug
.\Functions\Standalone\Message.ps1
.\Functions\Standalone\Delete-Chrome-Folder.ps1
```

### When to Use Standalone vs Integrated

#### Use Standalone for:
- **Complete, independent tools** (like server monitoring)
- **Scripts with complex UI loops** (like interactive prompts)
- **One-off utilities** that don't fit in the main menu system
- **Scripts that need immediate execution** (startup logic, configuration)

#### Use Integrated for:
- **Asset Control features** (computer management)
- **User management functions** (password reset, unlocking)
- **Core system functions** (logging, configuration)
- **Utility functions** shared by multiple features

### Converting Between Standalone and Integrated

#### Standalone → Integrated:
1. Wrap immediate execution code in function definitions
2. Add proper PowerShell documentation
3. Move to appropriate Functions/ subdirectory
4. Test that `. .\filename.ps1` loads without prompts
5. Add to menu configuration if needed

#### Integrated → Standalone:
1. Move from Functions/ subdirectory to Functions/Standalone/
2. Add immediate execution logic if needed
3. Remove from jarvis.ps1 loading (automatic - Standalone not loaded)
4. Remove from menu configurations

## Adding New Menu Systems

### Creating a New Menu Type
If you want to create a menu system similar to Asset Control for other features:

#### Step 1: Create Menu Template
Create `Templates/NewMenuType_Template.yaml`:

```yaml
menu:
  title: "<MENU_TITLE>"
  items:
    - id: 1
      name: "<ITEM_NAME>"
      function: "<FUNCTION_NAME>"
      module: "<MODULE_NAME>"
      description: "<DESCRIPTION>"
      enabled: true
```

#### Step 2: Create Menu Handler
Create `Functions/NewMenuType/menu.ps1`:

```powershell
<#
.SYNOPSIS
    Dynamic menu handler for NewMenuType features
.DESCRIPTION
    Reads YAML configuration and creates dynamic menu system
#>
function Show-NewMenuTypeMenu {
    param (
        [string]$userId,
        [string]$configPath = "Config/NewMenuType.yaml"
    )
    
    # Load menu configuration
    if (-not (Test-Path $configPath)) {
        Write-Error "Menu configuration not found: $configPath"
        return
    }
    
    try {
        $menuConfig = Get-Content $configPath -Raw | ConvertFrom-Yaml
    } catch {
        Write-Error "Failed to load menu configuration: $($_.Exception.Message)"
        return
    }
    
    # Display menu
    while ($true) {
        Clear-Host
        Write-Host $menuConfig.menu.title -ForegroundColor Cyan
        Write-Host ""
        
        $enabledItems = $menuConfig.menu.items | Where-Object { $_.enabled -eq $true }
        
        foreach ($item in $enabledItems) {
            Write-Host "$($item.id). $($item.name)"
            if ($item.description) {
                Write-Host "   $($item.description)" -ForegroundColor Gray
            }
        }
        
        Write-Host "0. Return to Main Menu"
        Write-Host ""
        
        $choice = Read-Host "Enter your choice"
        
        if ($choice -eq "0") { return }
        
        # Execute selected function
        $selectedItem = $enabledItems | Where-Object { $_.id -eq [int]$choice }
        if ($selectedItem) {
            $functionName = $selectedItem.function
            if (Get-Command $functionName -ErrorAction SilentlyContinue) {
                & $functionName -userId $userId
            } else {
                Write-Host "Function not found: $functionName" -ForegroundColor Red
                Read-Host "Press Enter to continue"
            }
        } else {
            Write-Host "Invalid choice" -ForegroundColor Red
            Start-Sleep 1
        }
    }
}
```

#### Step 3: Integrate with Main System
Add call to your new menu in the appropriate place (usually Main-Loop.ps1).

## Troubleshooting

### Common Issues

#### "Function not found" Error
- Check that the function name in YAML matches exactly (case-sensitive)
- Verify the module file exists in the correct folder
- Ensure jarvis.ps1 is loading the function file

#### Menu Not Appearing
- Check YAML syntax with online YAML validator
- Verify `enabled: true` is set for menu items
- Check file path and permissions

#### Configuration Not Loading
- Verify YAML file exists in `Config/` folder
- Check YAML syntax (indentation is critical)
- Run with `-Debug` flag to see loading messages

### Debug Mode
Run jarvis.ps1 with debug output:
```powershell
.\jarvis.ps1 -Debug
```

This will show:
- Function loading status
- Configuration file loading
- Menu system initialization
- Error details

### Log Analysis
- Check log files if logging is enabled
- Review `Show-LastLogEntries` output for user activity
- Use `Write-Debug` statements for troubleshooting

## Best Practices

### Code Quality
1. **Always use proper PowerShell documentation** (`.SYNOPSIS`, `.DESCRIPTION`, etc.)
2. **Include error handling** with try/catch blocks
3. **Use `Write-Debug`** for troubleshooting output
4. **Follow PowerShell naming conventions** (Verb-Noun format)
5. **Include parameter validation** where appropriate
6. **🚨 CRITICAL: No immediate execution code** - All code must be inside function definitions

### Security
1. **Never hardcode credentials** in scripts
2. **Validate user input** before processing
3. **Use least-privilege principles** for AD operations
4. **Log security-relevant actions**

### Maintainability
1. **Keep functions focused** on single responsibilities
2. **Use meaningful variable names**
3. **Comment complex logic**
4. **Maintain backward compatibility** when possible
5. **Test in development environment** first

### Performance
1. **Cache repeated AD queries** when possible
2. **Use efficient PowerShell patterns**
3. **Avoid unnecessary nested loops**
4. **Consider impact of network calls**

### Configuration Management
1. **Use YAML for user-editable settings**
2. **Provide sensible defaults**
3. **Validate configuration on load**
4. **Use templates for new configurations**

## Examples

### Adding Server Management to Asset Control

#### 1. Create the Function
```powershell
# Functions/AssetControl/server-management.ps1
function Get-ServerStatus {
    param (
        [string]$userId,
        [string]$serverName
    )
    
    if (-not $serverName) {
        $serverName = Read-Host "Enter server name"
    }
    
    try {
        $server = Get-ADComputer -Identity $serverName -Properties OperatingSystem, LastLogonDate
        Write-Host "Server: $($server.Name)" -ForegroundColor Green
        Write-Host "OS: $($server.OperatingSystem)" -ForegroundColor Cyan
        Write-Host "Last Logon: $($server.LastLogonDate)" -ForegroundColor Cyan
        
        # Test connectivity
        if (Test-Connection -ComputerName $serverName -Count 1 -Quiet) {
            Write-Host "Status: Online" -ForegroundColor Green
        } else {
            Write-Host "Status: Offline" -ForegroundColor Red
        }
        
    } catch {
        Write-Error "Failed to get server status: $($_.Exception.Message)"
    }
    
    Read-Host "Press Enter to continue"
}
```

#### 2. Add to Menu
```yaml
# Add to Config/AssetControlMenu.yaml
- id: 6
  name: "Server Status"
  function: "Get-ServerStatus"
  module: "server-management"
  description: "Check server status and connectivity"
  enabled: true
```

### Temporarily Disabling a Feature
To disable a feature without removing it:

```yaml
- id: 3
  name: "BitLocker Recovery"
  function: "Get-BitLockerRecovery"
  module: "bitlocker"
  description: "Get BitLocker recovery keys"
  enabled: false    # Changed from true to false
```

The feature will be hidden from the menu but can be easily re-enabled later.

## Getting Help

### Internal Resources
- Check `CLAUDE.md` for architectural decisions
- Review `PLAN.md` for implementation details  
- Use `Get-Help Function-Name` for function documentation
- Run with `-Debug` for troubleshooting information

### Testing Changes
1. Test in development environment first
2. Verify all menu options work
3. Test error conditions
4. Confirm logging still functions
5. Test with different user accounts

### Rollback Procedures
If changes cause issues:
1. Restore previous version of modified files
2. Check configuration files for syntax errors
3. Restart jarvis.ps1 to reload functions
4. Review debug output for error details

Remember: The modular architecture and YAML configuration system make most changes safe and reversible!

## 🚨 CRITICAL: Avoiding Immediate Execution Issues

### The Problem
When jarvis.ps1 loads function files, it **dot-sources** them (`. filename.ps1`). This means any code outside of function definitions **executes immediately** during startup, causing unwanted prompts or behavior.

### ❌ WRONG - Immediate Execution Code
```powershell
# This is WRONG - runs immediately when file is loaded
Import-Module SomeModule
$variable = "some value"
do {
    $input = Read-Host "Enter something"
    # ... more code ...
} while ($condition)

function My-Function {
    # function code here
}
```

### ✅ CORRECT - Function-Only Code
```powershell
<#
.SYNOPSIS
    Description of what this module does
#>

# This is CORRECT - only function definitions
function My-Function {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$true)]
        [string]$inputValue
    )
    
    # All logic goes inside the function
    Import-Module SomeModule -ErrorAction SilentlyContinue
    $variable = "some value"
    
    do {
        if (-not $inputValue) {
            $inputValue = Read-Host "Enter something"
        }
        # ... processing logic ...
    } while ($condition)
}

# Additional helper functions if needed
function Helper-Function {
    # helper logic here
}
```

### Converting Existing Scripts
If you have a script that runs immediately, wrap it in a function:

#### Before (Immediate Execution):
```powershell
$computerName = Read-Host "Enter computer name"
$result = Test-Connection $computerName
Write-Host "Result: $result"
```

#### After (Function Wrapped):
```powershell
function Test-ComputerConnection {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory=$false)]
        [string]$computerName
    )
    
    if (-not $computerName) {
        $computerName = Read-Host "Enter computer name"
    }
    
    $result = Test-Connection $computerName
    Write-Host "Result: $result"
}
```

### Testing Your Functions
To verify your function files don't execute immediately:

1. **Test loading**: `Get-Content YourFunction.ps1 | Out-Null`
2. **Test dot-sourcing**: `. .\YourFunction.ps1` (should return to prompt immediately)
3. **Test function call**: `Your-Function -Parameter "value"`

### Common Patterns to Avoid

#### ❌ Scripts with main loops:
```powershell
do {
    # main script logic
} while ($true)
```

#### ❌ Scripts with immediate imports:
```powershell
Import-Module ActiveDirectory  # Runs immediately!
```

#### ❌ Scripts with immediate variable assignments:
```powershell
$global:someVariable = Get-SomeData  # Runs immediately!
```

### Safe Patterns to Use

#### ✅ Import modules inside functions:
```powershell
function My-Function {
    Import-Module ActiveDirectory -ErrorAction SilentlyContinue
    # rest of function
}
```

#### ✅ Initialize variables inside functions:
```powershell
function My-Function {
    $localVariable = Get-SomeData
    # rest of function
}
```

#### ✅ Use parameters instead of prompts when possible:
```powershell
function My-Function {
    param (
        [string]$computerName = (Read-Host "Enter computer name")
    )
    # function logic
}
```

### Emergency Fix for Problematic Files
If a file causes jarvis.ps1 to hang during startup:

1. **Identify the file**: Look for `Read-Host` prompts during startup
2. **Move it temporarily**: `move Functions\Path\ProblemFile.ps1 Standalone-NotReady\`
3. **Fix the file**: Wrap code in function definitions
4. **Test the fix**: `. .\ProblemFile.ps1` should return immediately
5. **Move back**: `move Standalone-NotReady\ProblemFile.ps1 Functions\Path\`

### File Loading Order
jarvis.ps1 loads functions in this order:
1. `Functions/Core/` (required)
2. `Functions/UserManagement/` (required)
3. `Functions/Utilities/` (required)
4. `Functions/AssetControl/` (required)
5. `Functions/Standalone/` (optional)

If a file in an earlier directory has immediate execution, it will block loading of all subsequent files.

### Validation Checklist
Before adding any new .ps1 file to Functions/:

- [ ] File contains only function definitions and comments
- [ ] No code executes outside of functions
- [ ] All imports are inside functions
- [ ] All prompts (Read-Host) are inside functions
- [ ] File can be dot-sourced without prompting user
- [ ] Functions have proper PowerShell documentation
- [ ] Clear-Host commands are wrapped with debug checks

**Following these guidelines ensures jarvis.ps1 starts cleanly and your functions integrate properly with the modular system.**

## 🐛 Debug-Friendly Clear-Host Pattern

### The Issue
`Clear-Host` commands clear the screen, making it difficult to see error messages and debug output when troubleshooting issues. This hinders effective debugging and problem resolution.

### Solution: Debug-Aware Screen Clearing
Always wrap `Clear-Host` commands with debug checks to preserve screen output when debugging is enabled.

### ✅ CORRECT - Debug-Aware Clear-Host
```powershell
# In scripts that accept Debug parameter (like jarvis.ps1):
if (-not $PSBoundParameters['Debug']) { Clear-Host }

# In functions using DebugPreference (most other scripts):
if (-not $DebugPreference -eq 'Continue') { Clear-Host }
```

### ❌ WRONG - Always Clears Screen
```powershell
Clear-Host  # This clears screen even in debug mode
```

### Implementation Examples

#### For Main Entry Scripts (jarvis.ps1):
```powershell
param(
    [switch]$Debug
)

# Debug-aware screen clearing
if (-not $PSBoundParameters['Debug']) { Clear-Host }
```

#### For Functions and Other Scripts:
```powershell
function My-Function {
    [CmdletBinding()]
    param (
        [string]$parameter
    )
    
    # Debug-aware screen clearing
    if (-not $DebugPreference -eq 'Continue') { Clear-Host }
    
    # Rest of function logic
}
```

### Why This Matters
1. **Debugging**: Preserves error messages and debug output on screen
2. **Troubleshooting**: Allows developers to see what happened before the clear
3. **Development**: Makes it easier to trace execution flow
4. **User Experience**: Normal users still get clean screens, developers get helpful output

### Files That Should Use This Pattern
- **jarvis.ps1** - Main entry point
- **Main-Loop.ps1** - Main menu loop
- **Asset Control functions** - Menu systems that clear screens
- **Any function that calls Clear-Host**

### Testing Debug Mode
To test that debug mode preserves output:
```powershell
# Test with debug enabled
.\jarvis.ps1 -Debug

# Should see debug output and no screen clearing
```

### Converting Existing Clear-Host Commands
When you encounter `Clear-Host` in existing code:

1. **Identify the context**: Is this a script with parameters or a regular function?
2. **Choose the right pattern**: Use `$PSBoundParameters['Debug']` for scripts with Debug parameter, `$DebugPreference` for functions
3. **Test the change**: Verify debug mode preserves output and normal mode clears screen

This pattern ensures that developers can effectively debug issues while maintaining a clean user experience for normal operation.
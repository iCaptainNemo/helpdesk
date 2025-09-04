# 🚨 CRITICAL: Function File Rules

## The Golden Rule
**ALL CODE IN Functions/ MUST BE INSIDE FUNCTION DEFINITIONS**

## Why This Matters
When jarvis.ps1 loads function files using dot-sourcing (`. filename.ps1`), any code outside of functions **executes immediately** during startup, causing:
- Unwanted prompts during startup
- jarvis.ps1 hanging waiting for user input
- System failing to start properly

## ❌ WRONG - Causes Problems
```powershell
# This runs immediately when file is loaded!
Import-Module ActiveDirectory
$computerName = Read-Host "Enter computer name"
$result = Test-Connection $computerName

function My-Function {
    Write-Host "This is fine inside a function"
}
```

## ✅ CORRECT - Safe Loading
```powershell
<#
.SYNOPSIS
    My awesome function
#>

# Only function definitions and comments allowed here
function My-Function {
    # ALL logic goes inside the function
    Import-Module ActiveDirectory -ErrorAction SilentlyContinue
    $computerName = Read-Host "Enter computer name" 
    $result = Test-Connection $computerName
    Write-Host "Result: $result"
}
```

## Quick Test
Before adding any .ps1 file to Functions/:
```powershell
# This should return to prompt immediately (no prompts, no output)
. .\YourNewFile.ps1
```

## Emergency Fix
If jarvis.ps1 hangs during startup:
1. **Identify the problem file** (look for Read-Host prompts)
2. **Move it out**: `move Functions\Path\ProblemFile.ps1 Standalone-NotReady\`
3. **Fix it**: Wrap all code in function definitions
4. **Test it**: `. .\ProblemFile.ps1` should return immediately
5. **Move it back**: `move Standalone-NotReady\ProblemFile.ps1 Functions\Path\`

## Common Mistakes to Avoid
- `Import-Module` statements outside functions
- `Read-Host` prompts outside functions  
- Variable assignments outside functions
- `do`/`while` loops outside functions
- Any executable statements outside functions

## Remember
- **Comments are OK** outside functions
- **Function definitions are OK** outside functions
- **Everything else must be INSIDE functions**

**Following this rule keeps jarvis.ps1 startup clean and fast!** ✅
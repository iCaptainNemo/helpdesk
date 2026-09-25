const path = require('path');

/**
 * Every other script under Backend/functions/ is referenced by a literal
 * path.join(..., 'X.ps1') call somewhere in this codebase (fetchADObject.js,
 * lockedOutUsersUtils.js, ServerManageUtil.js, etc). pkg statically scans
 * compiled .js files for exactly that pattern and reliably bundles whatever
 * it finds - a separate, more trustworthy mechanism than the `assets` glob
 * in package.json, which was found to silently drop files with no working
 * config-level fix (confirmed via an isolated minimal reproduction outside
 * this project - see commit history).
 *
 * The scripts listed below are only ever invoked dynamically, by a variable
 * filename, in routes/executeScript.js (`${scriptName}.ps1`) - pkg's static
 * scanner can't resolve a template literal, so none of these ever got
 * auto-detected and all silently failed to bundle in the packaged exe. These
 * path.join() calls exist purely so pkg's scanner finds them; nothing here
 * needs to be exported or called at runtime.
 *
 * If you add a new script under Backend/functions/ that's only invoked
 * through executeScript.js's dynamic dispatch (i.e. not referenced by a
 * literal filename anywhere else), add a line for it here too.
 */
function registerDynamicallyInvokedScripts() {
    if (process.pkg) {
        return [
            path.join(process.cwd(), 'functions', 'Fetch-User.ps1'),
            path.join(process.cwd(), 'functions', 'Unlocker.ps1'),
            path.join(process.cwd(), 'functions', 'ForceGroupPolicyUpdate.ps1'),
            path.join(process.cwd(), 'functions', 'GetComputerSessions.ps1'),
            path.join(process.cwd(), 'functions', 'GetUserProcesses.ps1'),
            path.join(process.cwd(), 'functions', 'GetUserProfiles.ps1'),
            path.join(process.cwd(), 'functions', 'GraphicsDriverRestart.ps1'),
            path.join(process.cwd(), 'functions', 'RemoveUserProfiles.ps1'),
            path.join(process.cwd(), 'functions', 'RestartComputer.ps1'),
            path.join(process.cwd(), 'functions', 'RestartPrintSpooler.ps1'),
            path.join(process.cwd(), 'functions', 'StartShadowSession.ps1'),
            path.join(process.cwd(), 'functions', 'StopUserProcesses.ps1'),
        ];
    }
    return [
        path.join(__dirname, '../functions/Fetch-User.ps1'),
        path.join(__dirname, '../functions/Unlocker.ps1'),
        path.join(__dirname, '../functions/ForceGroupPolicyUpdate.ps1'),
        path.join(__dirname, '../functions/GetComputerSessions.ps1'),
        path.join(__dirname, '../functions/GetUserProcesses.ps1'),
        path.join(__dirname, '../functions/GetUserProfiles.ps1'),
        path.join(__dirname, '../functions/GraphicsDriverRestart.ps1'),
        path.join(__dirname, '../functions/RemoveUserProfiles.ps1'),
        path.join(__dirname, '../functions/RestartComputer.ps1'),
        path.join(__dirname, '../functions/RestartPrintSpooler.ps1'),
        path.join(__dirname, '../functions/StartShadowSession.ps1'),
        path.join(__dirname, '../functions/StopUserProcesses.ps1'),
    ];
}

module.exports = { registerDynamicallyInvokedScripts };

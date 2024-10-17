function Hide-Console {
    # Import necessary assemblies
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    # Hide the console window
    Add-Type -Name Window -Namespace Console -MemberDefinition '
    [DllImport("Kernel32.dll")]
    public static extern IntPtr GetConsoleWindow();

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, Int32 nCmdShow);
    '

    $console = [Console.Window]::GetConsoleWindow()

    # 0 hide
    [Console.Window]::ShowWindow($console, 0) | Out-Null
}
# Creates a "Finsanity Dev Tool" shortcut on the desktop that runs open-dev-tool.bat (minimised console, tool opens in the browser).
$bat = Join-Path $PSScriptRoot 'open-dev-tool.bat'
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut((Join-Path $desktop 'Finsanity Dev Tool.lnk'))
$lnk.TargetPath = $bat
$lnk.WorkingDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$lnk.WindowStyle = 7
$lnk.Description = 'Finsanity dev tool: sound audition, formulas, variables, commit to GitHub'
$lnk.IconLocation = "$env:SystemRoot\System32\shell32.dll,13"
$lnk.Save()
Write-Output "Created: $($lnk.FullName)"

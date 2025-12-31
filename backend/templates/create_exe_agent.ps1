# Create Windows Executable Agent
param(
    [string]$UserEmail,
    [string]$ApiKey,
    [string]$ApiEndpoint,
    [string]$OutputDir = "."
)

Write-Host "Creating Secure Habit Agent executable..." -ForegroundColor Green

# Read the PowerShell agent template
$agentTemplatePath = Join-Path $PSScriptRoot "secure_habit_agent.ps1"
$agentTemplate = Get-Content $agentTemplatePath -Raw

# Replace placeholders in PowerShell script
$agentScript = $agentTemplate -replace "{{USER_EMAIL}}", $UserEmail
$agentScript = $agentScript -replace "{{API_KEY}}", $ApiKey
$agentScript = $agentScript -replace "{{API_ENDPOINT}}", $ApiEndpoint

# Create temporary PowerShell script
$tempAgentPath = Join-Path $env:TEMP "secure_habit_agent_temp.ps1"
Set-Content -Path $tempAgentPath -Value $agentScript -Encoding UTF8

# Read the batch wrapper template
$wrapperTemplatePath = Join-Path $PSScriptRoot "agent_wrapper.bat"
$wrapperTemplate = Get-Content $wrapperTemplatePath -Raw

# Create the final executable package directory
$packageDir = Join-Path $OutputDir "SecureHabitAgent"
if (Test-Path $packageDir) {
    Remove-Item $packageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $packageDir -Force | Out-Null

# Copy files to package directory
Copy-Item $tempAgentPath -Destination (Join-Path $packageDir "secure_habit_agent.ps1")
Set-Content -Path (Join-Path $packageDir "SecureHabitAgent.bat") -Value $wrapperTemplate -Encoding ASCII

# Create a VBS script to run the batch file silently (optional)
$vbsScript = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "$packageDir\SecureHabitAgent.bat" & Chr(34), 0
Set WshShell = Nothing
"@

Set-Content -Path (Join-Path $packageDir "SecureHabitAgent_Silent.vbs") -Value $vbsScript -Encoding ASCII

# Create README file
$readmeContent = @"
Secure Habit - Security Agent
=============================

INSTALLATION INSTRUCTIONS:
--------------------------

Option 1 - Visible Execution (Recommended):
   Double-click: SecureHabitAgent.bat
   
Option 2 - Silent Execution:
   Double-click: SecureHabitAgent_Silent.vbs

WHAT HAPPENS:
- The agent will request administrator permissions
- It will scan your system for security vulnerabilities
- Results will be sent securely to your Secure Habit dashboard
- The process takes 2-5 minutes to complete

REQUIREMENTS:
- Windows 10/11
- Administrator privileges
- Internet connection

SUPPORT:
If you encounter any issues, please contact support
or check your Secure Habit dashboard for troubleshooting.

Generated for: $UserEmail
"@

Set-Content -Path (Join-Path $packageDir "README.txt") -Value $readmeContent -Encoding UTF8

# Clean up temporary file
Remove-Item $tempAgentPath -Force -ErrorAction SilentlyContinue

Write-Host "✅ Agent package created successfully!" -ForegroundColor Green
Write-Host "📁 Location: $packageDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "Package Contents:" -ForegroundColor Cyan
Write-Host "  - SecureHabitAgent.bat (Double-click to run)" -ForegroundColor White
Write-Host "  - SecureHabitAgent_Silent.vbs (Silent execution)" -ForegroundColor White
Write-Host "  - secure_habit_agent.ps1 (Core agent script)" -ForegroundColor Gray
Write-Host "  - README.txt (Installation instructions)" -ForegroundColor Gray
Write-Host ""
Write-Host "🚀 Ready for deployment!" -ForegroundColor Green

return $packageDir
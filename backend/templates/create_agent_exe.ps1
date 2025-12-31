# Script to convert PowerShell agent to Windows executable
param(
    [string]$UserEmail,
    [string]$ApiKey,
    [string]$ApiEndpoint,
    [string]$OutputPath = "SecureHabitAgent.exe"
)

# Install ps2exe if not available
if (!(Get-Module -ListAvailable -Name ps2exe)) {
    Write-Host "Installing ps2exe module..."
    Install-Module -Name ps2exe -Force -Scope CurrentUser
}

# Read the agent template
$templatePath = Join-Path $PSScriptRoot "secure_habit_agent.ps1"
$template = Get-Content $templatePath -Raw

# Replace placeholders
$agentScript = $template -replace "{{USER_EMAIL}}", $UserEmail
$agentScript = $agentScript -replace "{{API_KEY}}", $ApiKey
$agentScript = $agentScript -replace "{{API_ENDPOINT}}", $ApiEndpoint

# Create temporary script file
$tempScript = Join-Path $env:TEMP "temp_agent.ps1"
Set-Content -Path $tempScript -Value $agentScript

try {
    # Convert to executable
    Import-Module ps2exe
    
    Invoke-ps2exe -inputFile $tempScript -outputFile $OutputPath -requireAdmin -noConsole -title "Secure Habit Agent" -description "Secure Habit Endpoint Security Agent" -company "Secure Habit" -version "1.0.0.0" -copyright "© 2024 Secure Habit"
    
    Write-Host "✅ Executable created: $OutputPath"
    
    # Clean up
    Remove-Item $tempScript -Force
    
    return $true
}
catch {
    Write-Host "❌ Error creating executable: $_"
    Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
    return $false
}
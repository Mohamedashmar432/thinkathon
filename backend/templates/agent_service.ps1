#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Security Agent Service - Persistent Background Agent
.DESCRIPTION
    Runs as a persistent service, connects to backend via WebSocket
.NOTES
    Requires Administrator privileges
    Generated for: {{USER_EMAIL}}
#>

param(
    [string]$Action = "install"
)

# Configuration
$API_ENDPOINT = "{{API_ENDPOINT}}"
$WS_ENDPOINT = "{{WS_ENDPOINT}}"
$API_KEY = "{{API_KEY}}"
$USER_EMAIL = "{{USER_EMAIL}}"
$SERVICE_NAME = "SecurityVulnerabilityAgent"
$AGENT_VERSION = "1.0.0"

# Agent installation directory
$AGENT_DIR = "C:\Program Files\SecurityAgent"
$CONFIG_FILE = "$AGENT_DIR\config.json"
$LOG_FILE = "$AGENT_DIR\logs\agent.log"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    if (Test-Path (Split-Path $LOG_FILE)) {
        Add-Content -Path $LOG_FILE -Value $logMessage
    }
}

function Get-StableDeviceID {
    try {
        $bios = Get-CimInstance Win32_BIOS
        $cs = Get-CimInstance Win32_ComputerSystem
        $mb = Get-CimInstance Win32_BaseBoard
        
        $combined = "$($bios.SerialNumber)_$($cs.Model)_$($mb.SerialNumber)"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($combined)
        $hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
        return [System.BitConverter]::ToString($hash).Replace("-","").Substring(0, 32)
    }
    catch {
        Write-Log "Could not generate stable device ID: $_"
        return "DEVICE_$(Get-Random -Maximum 999999)"
    }
}

function Install-Agent {
    Write-Log "Installing Security Agent..."
    
    try {
        # Create agent directory
        if (!(Test-Path $AGENT_DIR)) {
            New-Item -ItemType Directory -Path $AGENT_DIR -Force | Out-Null
            New-Item -ItemType Directory -Path "$AGENT_DIR\logs" -Force | Out-Null
        }

        # Create configuration file
        $config = @{
            apiKey = $API_KEY
            userEmail = $USER_EMAIL
            apiEndpoint = $API_ENDPOINT
            wsEndpoint = $WS_ENDPOINT
            version = $AGENT_VERSION
            deviceId = Get-StableDeviceID
        } | ConvertTo-Json -Depth 3

        Set-Content -Path $CONFIG_FILE -Value $config

        # Copy this script to agent directory
        Copy-Item $PSCommandPath "$AGENT_DIR\agent.ps1" -Force

        # Create Windows Service
        $servicePath = "powershell.exe -ExecutionPolicy Bypass -File `"$AGENT_DIR\agent.ps1`" -Action service"
        
        # Remove existing service if it exists
        $existingService = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
        if ($existingService) {
            Stop-Service -Name $SERVICE_NAME -Force -ErrorAction SilentlyContinue
            sc.exe delete $SERVICE_NAME | Out-Null
            Start-Sleep -Seconds 2
        }

        # Create new service
        sc.exe create $SERVICE_NAME binPath= $servicePath start= auto | Out-Null
        sc.exe description $SERVICE_NAME "Security Vulnerability Agent - Monitors system security" | Out-Null
        
        # Start service
        Start-Service -Name $SERVICE_NAME
        
        Write-Log "Agent installed and started successfully"
        Write-Host "✅ Security Agent installed successfully!"
        Write-Host "   Service Name: $SERVICE_NAME"
        Write-Host "   Install Path: $AGENT_DIR"
        Write-Host "   Device ID: $(Get-StableDeviceID)"
        
        return $true
    }
    catch {
        Write-Log "Installation failed: $_"
        Write-Host "❌ Installation failed: $_"
        return $false
    }
}

function Uninstall-Agent {
    Write-Log "Uninstalling Security Agent..."
    
    try {
        # Stop and remove service
        Stop-Service -Name $SERVICE_NAME -Force -ErrorAction SilentlyContinue
        sc.exe delete $SERVICE_NAME | Out-Null
        
        # Remove agent directory
        if (Test-Path $AGENT_DIR) {
            Remove-Item -Path $AGENT_DIR -Recurse -Force
        }
        
        Write-Log "Agent uninstalled successfully"
        Write-Host "✅ Security Agent uninstalled successfully!"
        return $true
    }
    catch {
        Write-Log "Uninstallation failed: $_"
        Write-Host "❌ Uninstallation failed: $_"
        return $false
    }
}

function Start-AgentService {
    Write-Log "Starting Security Agent Service..."
    
    # Load configuration
    if (!(Test-Path $CONFIG_FILE)) {
        Write-Log "Configuration file not found: $CONFIG_FILE"
        return
    }
    
    $config = Get-Content $CONFIG_FILE | ConvertFrom-Json
    $deviceId = $config.deviceId
    
    Write-Log "Agent starting - Device ID: $deviceId"
    
    # Main service loop
    while ($true) {
        try {
            # Connect to WebSocket
            Connect-ToBackend -Config $config
        }
        catch {
            Write-Log "Service error: $_"
            Start-Sleep -Seconds 30
        }
    }
}

function Connect-ToBackend {
    param($Config)
    
    Write-Log "Connecting to backend: $($Config.wsEndpoint)"
    
    try {
        # Create WebSocket connection (simplified - in production use proper WebSocket client)
        $headers = @{
            "Authorization" = "Bearer $($Config.apiKey)"
            "X-Device-Id" = $Config.deviceId
            "X-User-Email" = $Config.userEmail
        }
        
        # Send heartbeat every 30 seconds
        $heartbeatTimer = 0
        
        while ($true) {
            # Send heartbeat
            if ($heartbeatTimer % 30 -eq 0) {
                Send-Heartbeat -Config $Config
            }
            
            # Check for commands (simplified - poll API endpoint)
            $commands = Get-PendingCommands -Config $Config
            foreach ($command in $commands) {
                Process-Command -Command $command -Config $Config
            }
            
            Start-Sleep -Seconds 1
            $heartbeatTimer++
        }
    }
    catch {
        Write-Log "Connection error: $_"
        throw
    }
}

function Send-Heartbeat {
    param($Config)
    
    try {
        $systemInfo = Get-SystemInfo
        $heartbeat = @{
            type = "HEARTBEAT"
            deviceId = $Config.deviceId
            timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            status = "active"
            version = $Config.version
            systemInfo = $systemInfo
        } | ConvertTo-Json -Depth 3
        
        # In a real implementation, this would send via WebSocket
        # For now, we'll use HTTP POST as a fallback
        $uri = $Config.apiEndpoint.Replace("/submit", "/heartbeat")
        
        Invoke-RestMethod -Uri $uri -Method POST -Body $heartbeat -ContentType "application/json" -Headers @{
            "Authorization" = "Bearer $($Config.apiKey)"
            "X-Device-Id" = $Config.deviceId
            "X-User-Email" = $Config.userEmail
        } -ErrorAction SilentlyContinue
        
        Write-Log "Heartbeat sent"
    }
    catch {
        Write-Log "Heartbeat failed: $_"
    }
}

function Get-SystemInfo {
    try {
        $cs = Get-CimInstance Win32_ComputerSystem
        $os = Get-CimInstance Win32_OperatingSystem
        
        return @{
            computerName = $env:COMPUTERNAME
            osName = $os.Caption
            osVersion = $os.Version
            architecture = $os.OSArchitecture
            manufacturer = $cs.Manufacturer
            model = $cs.Model
        }
    }
    catch {
        return @{}
    }
}

function Get-PendingCommands {
    param($Config)
    
    try {
        # Poll for commands (simplified implementation)
        $uri = $Config.apiEndpoint.Replace("/submit", "/commands")
        $response = Invoke-RestMethod -Uri $uri -Method GET -Headers @{
            "Authorization" = "Bearer $($Config.apiKey)"
            "X-Device-Id" = $Config.deviceId
            "X-User-Email" = $Config.userEmail
        } -ErrorAction SilentlyContinue
        
        return $response.commands
    }
    catch {
        return @()
    }
}

function Process-Command {
    param($Command, $Config)
    
    Write-Log "Processing command: $($Command.type)"
    
    switch ($Command.type) {
        "QUICK_SCAN" {
            Start-QuickScan -Config $Config
        }
        "FULL_SCAN" {
            Start-FullScan -Config $Config
        }
        "UNINSTALL_SOFTWARE" {
            Uninstall-Software -SoftwareName $Command.payload -Config $Config
        }
        "SELF_DESTRUCT" {
            Start-SelfDestruct -Config $Config
        }
        default {
            Write-Log "Unknown command: $($Command.type)"
        }
    }
}

function Start-QuickScan {
    param($Config)
    
    Write-Log "Starting quick scan..."
    
    try {
        # Run the existing scanner script logic (simplified)
        $scanData = @{
            deviceId = $Config.deviceId
            scanTimestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            systemInfo = Get-SystemInfo
            software = Get-InstalledSoftware
            scanType = "quick"
        }
        
        # Send scan results
        $body = $scanData | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Uri $Config.apiEndpoint -Method POST -Body $body -ContentType "application/json" -Headers @{
            "Authorization" = "Bearer $($Config.apiKey)"
            "X-User-Email" = $Config.userEmail
        }
        
        Write-Log "Quick scan completed and submitted"
    }
    catch {
        Write-Log "Quick scan failed: $_"
    }
}

function Start-FullScan {
    param($Config)
    
    Write-Log "Starting full scan..."
    
    try {
        # Run comprehensive scan
        $scanData = @{
            deviceId = $Config.deviceId
            scanTimestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            systemInfo = Get-SystemInfo
            software = Get-InstalledSoftware
            browserExtensions = Get-BrowserExtensions
            patches = Get-PatchInfo
            scanType = "full"
        }
        
        # Send scan results
        $body = $scanData | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Uri $Config.apiEndpoint -Method POST -Body $body -ContentType "application/json" -Headers @{
            "Authorization" = "Bearer $($Config.apiKey)"
            "X-User-Email" = $Config.userEmail
        }
        
        Write-Log "Full scan completed and submitted"
    }
    catch {
        Write-Log "Full scan failed: $_"
    }
}

function Get-InstalledSoftware {
    $software = @()
    $regPaths = @(
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    
    foreach ($path in $regPaths) {
        try {
            $items = Get-ItemProperty $path -ErrorAction SilentlyContinue
            foreach ($item in $items) {
                if ($item.DisplayName) {
                    $software += @{
                        name = $item.DisplayName
                        version = if ($item.DisplayVersion) { $item.DisplayVersion } else { "Unknown" }
                        publisher = if ($item.Publisher) { $item.Publisher } else { "Unknown" }
                        installDate = if ($item.InstallDate) { $item.InstallDate } else { "" }
                    }
                }
            }
        }
        catch {
            Write-Log "Could not access registry path: $path"
        }
    }
    
    return $software | Sort-Object name -Unique
}

function Get-BrowserExtensions {
    $extensions = @()
    
    # Chrome extensions
    $chromePath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Extensions"
    if (Test-Path $chromePath) {
        Get-ChildItem $chromePath -Directory | ForEach-Object {
            $manifestPath = Join-Path $_.FullName "*/manifest.json"
            $manifests = Get-ChildItem $manifestPath -ErrorAction SilentlyContinue
            foreach ($manifest in $manifests) {
                try {
                    $content = Get-Content $manifest.FullName | ConvertFrom-Json
                    $extensions += @{
                        browser = "Chrome"
                        name = $content.name
                        version = $content.version
                        extensionId = $_.Name
                    }
                }
                catch {
                    # Skip invalid manifests
                }
            }
        }
    }
    
    return $extensions
}

function Get-PatchInfo {
    try {
        $patches = Get-HotFix | Sort-Object InstalledOn -Descending
        $latest = $patches | Select-Object -First 1
        
        return @{
            totalPatches = $patches.Count
            latestPatchId = if ($latest) { $latest.HotFixID } else { "" }
            latestPatchDate = if ($latest -and $latest.InstalledOn) { $latest.InstalledOn.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") } else { (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
        }
    }
    catch {
        return @{
            totalPatches = 0
            latestPatchId = ""
            latestPatchDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
    }
}

function Start-SelfDestruct {
    param($Config)
    
    Write-Log "Self-destruct initiated"
    
    # Create uninstall script
    $uninstallScript = @"
@echo off
timeout /t 5 /nobreak
sc stop $SERVICE_NAME
sc delete $SERVICE_NAME
rmdir /s /q "$AGENT_DIR"
del "%~f0"
"@
    
    $scriptPath = "$env:TEMP\uninstall_agent.bat"
    Set-Content -Path $scriptPath -Value $uninstallScript
    
    # Execute uninstall script
    Start-Process -FilePath $scriptPath -WindowStyle Hidden
    
    # Stop service
    Stop-Service -Name $SERVICE_NAME -Force
}

# Main execution logic
switch ($Action.ToLower()) {
    "install" {
        Install-Agent
    }
    "uninstall" {
        Uninstall-Agent
    }
    "service" {
        Start-AgentService
    }
    default {
        Write-Host "Usage: agent.ps1 -Action [install|uninstall|service]"
    }
}
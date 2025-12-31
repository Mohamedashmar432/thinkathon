# Simple connectivity test for Secure Habit Agent

$API_ENDPOINT = "https://secure-habit-backend.onrender.com/api/scan/submit"
$API_KEY = "42627a39b74bf1cb44d801d9dc861a85f4524495cb1dc63a93712aace6a7c5f7"
$USER_EMAIL = "mohamedashmar123@gmail.com"

Write-Host "Testing Secure Habit Agent Connectivity"
Write-Host "======================================="
Write-Host ""

Write-Host "Testing endpoint: $API_ENDPOINT"
Write-Host "User email: $USER_EMAIL"
Write-Host ""

# Test basic connectivity to the backend
Write-Host "1. Testing backend health..."
try {
    $healthResponse = Invoke-RestMethod -Uri "https://secure-habit-backend.onrender.com/health" -Method GET -TimeoutSec 10
    if ($healthResponse.status -eq "ok") {
        Write-Host "SUCCESS: Backend is healthy and responding"
        Write-Host "Environment: $($healthResponse.environment)"
    } else {
        Write-Host "ERROR: Backend health check failed"
        exit 1
    }
} catch {
    Write-Host "ERROR: Cannot reach backend: $($_.Exception.Message)"
    exit 1
}

Write-Host ""

# Test scan endpoint with minimal data
Write-Host "2. Testing scan endpoint connectivity..."

$testData = @{
    deviceId = "TEST_DEVICE_$(Get-Random)"
    scanTimestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z")
    systemInfo = @{
        computerName = $env:COMPUTERNAME
        osName = "Windows"
        osVersion = "Test"
        architecture = "x64"
        manufacturer = "Test"
        model = "Test"
        serialNumber = "Test"
    }
    software = @()
    browserExtensions = @()
    patches = @{
        totalPatches = 0
        latestPatchId = ""
        latestPatchDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    }
    agentVersion = "1.0.0"
    scanType = "connectivity_test"
}

$jsonData = $testData | ConvertTo-Json -Depth 10

$headers = @{
    "Authorization" = "Bearer $API_KEY"
    "X-User-Email" = $USER_EMAIL
    "Content-Type" = "application/json"
    "User-Agent" = "SecureHabit-Agent-Test/1.0.0"
}

try {
    Write-Host "Sending test scan data..."
    $response = Invoke-RestMethod -Uri $API_ENDPOINT -Method POST -Body $jsonData -Headers $headers -TimeoutSec 30
    
    if ($response.success) {
        Write-Host "SUCCESS: Scan endpoint connectivity successful!"
        Write-Host "Scan ID: $($response.scanId)"
        Write-Host "Message: $($response.message)"
    } else {
        Write-Host "ERROR: Scan submission failed: $($response.message)"
        exit 1
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorMessage = $_.Exception.Message
    
    Write-Host "ERROR: Scan endpoint test failed"
    Write-Host "Status Code: $statusCode"
    Write-Host "Error: $errorMessage"
    
    if ($statusCode -eq 401) {
        Write-Host "Authentication issue - API key may be invalid"
    } elseif ($statusCode -eq 400) {
        Write-Host "Bad request - data format issue"
    } elseif ($statusCode -eq 500) {
        Write-Host "Server error - backend issue"
    } else {
        Write-Host "Network or connectivity issue"
    }
    
    exit 1
}

Write-Host ""
Write-Host "ALL CONNECTIVITY TESTS PASSED!"
Write-Host "=============================="
Write-Host ""
Write-Host "The production endpoint is working correctly."
Write-Host "Your issue was using an old agent file with localhost endpoint."
Write-Host ""
Write-Host "To get a fresh agent:"
Write-Host "1. Go to https://securehabit.vercel.app/"
Write-Host "2. Sign in to your account"
Write-Host "3. Navigate to Agents page"
Write-Host "4. Download a new Windows agent"
Write-Host "5. Run the new agent"
Write-Host ""
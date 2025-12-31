#!/bin/bash

# Secure Habit - Linux Security Agent
# Requires root privileges for comprehensive system scanning
# Generated for: {{USER_EMAIL}}

set -euo pipefail

# Configuration
API_ENDPOINT="{{API_ENDPOINT}}"
API_KEY="{{API_KEY}}"
USER_EMAIL="{{USER_EMAIL}}"
AGENT_VERSION="1.0.0"

# Logging
LOG_DIR="/tmp/secure-habit"
LOG_FILE="$LOG_DIR/agent.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create log directory
mkdir -p "$LOG_DIR"

# Logging function
log() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $message" >> "$LOG_FILE"
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $message"
}

# Error logging
log_error() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] ERROR: $message" >> "$LOG_FILE"
    echo -e "${RED}[ERROR]${NC} $message" >&2
}

# Success logging
log_success() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] SUCCESS: $message" >> "$LOG_FILE"
    echo -e "${GREEN}[SUCCESS]${NC} $message"
}

# Warning logging
log_warning() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] WARNING: $message" >> "$LOG_FILE"
    echo -e "${YELLOW}[WARNING]${NC} $message"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        echo -e "${RED}Please run: sudo $0${NC}"
        exit 1
    fi
}

# Generate stable device ID
get_device_id() {
    local machine_id=""
    
    # Try different methods to get a stable machine ID
    if [[ -f /etc/machine-id ]]; then
        machine_id=$(cat /etc/machine-id 2>/dev/null || echo "")
    elif [[ -f /var/lib/dbus/machine-id ]]; then
        machine_id=$(cat /var/lib/dbus/machine-id 2>/dev/null || echo "")
    fi
    
    # Fallback to hardware-based ID
    if [[ -z "$machine_id" ]]; then
        local cpu_info=$(cat /proc/cpuinfo | grep -E "(processor|vendor_id|model name)" | head -3 | md5sum | cut -d' ' -f1 2>/dev/null || echo "")
        local hostname=$(hostname 2>/dev/null || echo "unknown")
        machine_id="${cpu_info}_${hostname}"
    fi
    
    # Generate final device ID
    echo "LINUX_$(echo "$machine_id" | sha256sum | cut -d' ' -f1 | head -c 32)"
}

# Get system information
get_system_info() {
    local os_name="Unknown Linux"
    local os_version="Unknown"
    local architecture=$(uname -m 2>/dev/null || echo "unknown")
    local hostname=$(hostname 2>/dev/null || echo "unknown")
    
    # Detect distribution
    if [[ -f /etc/os-release ]]; then
        source /etc/os-release
        os_name="$NAME"
        os_version="$VERSION_ID"
    elif [[ -f /etc/redhat-release ]]; then
        os_name=$(cat /etc/redhat-release)
        os_version="Unknown"
    elif [[ -f /etc/debian_version ]]; then
        os_name="Debian"
        os_version=$(cat /etc/debian_version)
    fi
    
    # Get additional hardware info
    local manufacturer="Unknown"
    local model="Unknown"
    
    if command -v dmidecode >/dev/null 2>&1; then
        manufacturer=$(dmidecode -s system-manufacturer 2>/dev/null | head -1 || echo "Unknown")
        model=$(dmidecode -s system-product-name 2>/dev/null | head -1 || echo "Unknown")
    fi
    
    cat << EOF
{
    "computerName": "$hostname",
    "osName": "$os_name",
    "osVersion": "$os_version",
    "architecture": "$architecture",
    "manufacturer": "$manufacturer",
    "model": "$model",
    "kernelVersion": "$(uname -r 2>/dev/null || echo 'unknown')"
}
EOF
}

# Get installed packages
get_installed_software() {
    log "Scanning installed packages..."
    
    local packages_json="["
    local first=true
    
    # Function to add package to JSON
    add_package() {
        local name="$1"
        local version="$2"
        local source="$3"
        
        # Skip empty names
        [[ -z "$name" ]] && return
        
        # Escape JSON strings
        name=$(echo "$name" | sed 's/"/\\"/g')
        version=$(echo "$version" | sed 's/"/\\"/g')
        source=$(echo "$source" | sed 's/"/\\"/g')
        
        if [[ "$first" == true ]]; then
            first=false
        else
            packages_json+=","
        fi
        
        packages_json+="{\"name\":\"$name\",\"version\":\"$version\",\"publisher\":\"$source\",\"installDate\":\"\",\"uninstallString\":\"\"}"
    }
    
    # APT packages (Debian/Ubuntu)
    if command -v dpkg >/dev/null 2>&1; then
        log "Scanning APT packages..."
        while IFS= read -r line; do
            if [[ -n "$line" ]]; then
                local name=$(echo "$line" | awk '{print $2}')
                local version=$(echo "$line" | awk '{print $3}')
                add_package "$name" "$version" "APT"
            fi
        done < <(dpkg-query -W -f='${Status} ${Package} ${Version}\n' 2>/dev/null | grep "^install ok installed" || true)
    fi
    
    # YUM/DNF packages (RedHat/CentOS/Fedora)
    if command -v rpm >/dev/null 2>&1; then
        log "Scanning RPM packages..."
        while IFS= read -r line; do
            if [[ -n "$line" ]]; then
                local name=$(echo "$line" | cut -d' ' -f1)
                local version=$(echo "$line" | cut -d' ' -f2)
                add_package "$name" "$version" "RPM"
            fi
        done < <(rpm -qa --queryformat '%{NAME} %{VERSION}-%{RELEASE}\n' 2>/dev/null || true)
    fi
    
    # Snap packages
    if command -v snap >/dev/null 2>&1; then
        log "Scanning Snap packages..."
        while IFS= read -r line; do
            if [[ -n "$line" && "$line" != "Name"* ]]; then
                local name=$(echo "$line" | awk '{print $1}')
                local version=$(echo "$line" | awk '{print $2}')
                add_package "$name" "$version" "Snap"
            fi
        done < <(snap list 2>/dev/null | tail -n +2 || true)
    fi
    
    # Flatpak packages
    if command -v flatpak >/dev/null 2>&1; then
        log "Scanning Flatpak packages..."
        while IFS= read -r line; do
            if [[ -n "$line" ]]; then
                local name=$(echo "$line" | awk '{print $1}')
                local version=$(echo "$line" | awk '{print $2}')
                add_package "$name" "$version" "Flatpak"
            fi
        done < <(flatpak list --app --columns=name,version 2>/dev/null || true)
    fi
    
    # AppImage detection (common locations)
    if [[ -d "$HOME/Applications" ]]; then
        log "Scanning AppImages..."
        find "$HOME/Applications" -name "*.AppImage" -type f 2>/dev/null | while read -r appimage; do
            local name=$(basename "$appimage" .AppImage)
            add_package "$name" "Unknown" "AppImage"
        done || true
    fi
    
    packages_json+="]"
    echo "$packages_json"
}

# Get browser extensions (limited support)
get_browser_extensions() {
    log "Scanning browser extensions..."
    
    local extensions_json="["
    local first=true
    
    # Function to add extension to JSON
    add_extension() {
        local browser="$1"
        local name="$2"
        local version="$3"
        local ext_id="$4"
        
        # Escape JSON strings
        name=$(echo "$name" | sed 's/"/\\"/g')
        version=$(echo "$version" | sed 's/"/\\"/g')
        
        if [[ "$first" == true ]]; then
            first=false
        else
            extensions_json+=","
        fi
        
        extensions_json+="{\"browser\":\"$browser\",\"name\":\"$name\",\"version\":\"$version\",\"extensionId\":\"$ext_id\"}"
    }
    
    # Chrome extensions (if Chrome is installed)
    local chrome_dir="$HOME/.config/google-chrome/Default/Extensions"
    if [[ -d "$chrome_dir" ]]; then
        log "Scanning Chrome extensions..."
        find "$chrome_dir" -name "manifest.json" -type f 2>/dev/null | while read -r manifest; do
            local ext_dir=$(dirname "$manifest")
            local ext_id=$(basename "$(dirname "$ext_dir")")
            
            if [[ -f "$manifest" ]]; then
                local name=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$manifest" 2>/dev/null | cut -d'"' -f4 || echo "Unknown")
                local version=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$manifest" 2>/dev/null | cut -d'"' -f4 || echo "Unknown")
                
                if [[ "$name" != "Unknown" ]]; then
                    add_extension "Chrome" "$name" "$version" "$ext_id"
                fi
            fi
        done || true
    fi
    
    # Firefox extensions (basic detection)
    local firefox_dir="$HOME/.mozilla/firefox"
    if [[ -d "$firefox_dir" ]]; then
        log "Firefox extensions detected but detailed scanning requires additional permissions"
    fi
    
    extensions_json+="]"
    echo "$extensions_json"
}

# Get patch/update information
get_patch_info() {
    log "Gathering system update information..."
    
    local total_patches=0
    local latest_patch_date=""
    local latest_patch_id=""
    
    # Check for available updates based on package manager
    if command -v apt >/dev/null 2>&1; then
        # Update package list
        apt update >/dev/null 2>&1 || true
        total_patches=$(apt list --upgradable 2>/dev/null | wc -l || echo "0")
        latest_patch_date=$(date -Iseconds)
        latest_patch_id="apt-updates-available"
    elif command -v yum >/dev/null 2>&1; then
        total_patches=$(yum check-update 2>/dev/null | grep -v "^$" | wc -l || echo "0")
        latest_patch_date=$(date -Iseconds)
        latest_patch_id="yum-updates-available"
    elif command -v dnf >/dev/null 2>&1; then
        total_patches=$(dnf check-update 2>/dev/null | grep -v "^$" | wc -l || echo "0")
        latest_patch_date=$(date -Iseconds)
        latest_patch_id="dnf-updates-available"
    fi
    
    # Fallback date if none found
    if [[ -z "$latest_patch_date" ]]; then
        latest_patch_date=$(date -d "30 days ago" -Iseconds)
    fi
    
    cat << EOF
{
    "totalPatches": $total_patches,
    "latestPatchId": "$latest_patch_id",
    "latestPatchDate": "$latest_patch_date"
}
EOF
}

# Submit inventory data to backend
submit_inventory_data() {
    local inventory_data="$1"
    
    log "Submitting inventory data to Secure Habit platform..."
    
    # Create temporary file for JSON data
    local temp_file=$(mktemp)
    echo "$inventory_data" > "$temp_file"
    
    # Submit data using curl
    local response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Authorization: Bearer $API_KEY" \
        -H "X-User-Email: $USER_EMAIL" \
        -H "Content-Type: application/json" \
        -H "User-Agent: SecureHabit-Agent-Linux/$AGENT_VERSION" \
        --data "@$temp_file" \
        --connect-timeout 30 \
        --max-time 60 \
        "$API_ENDPOINT" 2>/dev/null || echo -e "\n000")
    
    # Clean up temp file
    rm -f "$temp_file"
    
    # Parse response
    local http_code=$(echo "$response" | tail -n1)
    local response_body=$(echo "$response" | head -n -1)
    
    if [[ "$http_code" == "200" ]]; then
        local success=$(echo "$response_body" | grep -o '"success"[[:space:]]*:[[:space:]]*true' || echo "")
        if [[ -n "$success" ]]; then
            local scan_id=$(echo "$response_body" | grep -o '"scanId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")
            log_success "Inventory data submitted successfully. Scan ID: $scan_id"
            
            # Register agent
            register_agent "$device_id" "$system_info_json"
            
            return 0
        else
            local error_msg=$(echo "$response_body" | grep -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "Unknown error")
            log_error "Failed to submit inventory data: $error_msg"
            return 1
        fi
    else
        log_error "HTTP error $http_code when submitting inventory data"
        if [[ "$http_code" == "401" ]]; then
            log_error "Authentication failed. Please re-download the agent."
        elif [[ "$http_code" == "000" ]]; then
            log_error "Network connection failed. Please check your internet connection."
        fi
        return 1
    fi
}

# Register agent with backend
register_agent() {
    local device_id="$1"
    local system_info="$2"
    
    log "Registering agent with backend..."
    
    local agent_data=$(cat << EOF
{
    "deviceId": "$device_id",
    "deviceName": "$(hostname)",
    "version": "$AGENT_VERSION",
    "systemInfo": $system_info,
    "status": "active",
    "timestamp": "$(date -Iseconds)"
}
EOF
)
    
    local agent_endpoint="${API_ENDPOINT/\/scan\/submit/\/agent\/register}"
    
    # Create temporary file for JSON data
    local temp_file=$(mktemp)
    echo "$agent_data" > "$temp_file"
    
    local response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Authorization: Bearer $API_KEY" \
        -H "X-User-Email: $USER_EMAIL" \
        -H "Content-Type: application/json" \
        -H "User-Agent: SecureHabit-Agent-Linux/$AGENT_VERSION" \
        --data "@$temp_file" \
        --connect-timeout 30 \
        --max-time 30 \
        "$agent_endpoint" 2>/dev/null || echo -e "\n000")
    
    # Clean up temp file
    rm -f "$temp_file"
    
    local http_code=$(echo "$response" | tail -n1)
    
    if [[ "$http_code" == "200" ]]; then
        log_success "Agent registered successfully"
    else
        log_warning "Agent registration failed (HTTP $http_code), but scan data was submitted"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "    Secure Habit - Linux Security Agent"
    echo "=========================================="
    echo -e "${NC}"
    echo
    echo "Starting comprehensive security scan..."
    echo "This may take 2-5 minutes depending on system size."
    echo
    
    log "=== Secure Habit Linux Agent Started ==="
    log "Version: $AGENT_VERSION"
    log "User: $USER_EMAIL"
    
    # Check root privileges
    check_root
    
    # Get device information
    local device_id=$(get_device_id)
    log "Device ID: $device_id"
    
    # Get system information
    log "Collecting system information..."
    local system_info_json=$(get_system_info)
    local os_name=$(echo "$system_info_json" | grep -o '"osName"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    log "System: $os_name"
    
    # Collect inventory data
    log "Starting software inventory collection..."
    local software_json=$(get_installed_software)
    local software_count=$(echo "$software_json" | grep -o '"name"' | wc -l)
    log "Software collection completed: $software_count packages"
    
    log "Starting browser extension scan..."
    local extensions_json=$(get_browser_extensions)
    local extensions_count=$(echo "$extensions_json" | grep -o '"name"' | wc -l)
    log "Browser extension scan completed: $extensions_count extensions"
    
    log "Gathering patch information..."
    local patches_json=$(get_patch_info)
    log "Patch information collected"
    
    # Prepare inventory payload
    local inventory_data=$(cat << EOF
{
    "deviceId": "$device_id",
    "scanTimestamp": "$(date -Iseconds)",
    "systemInfo": $system_info_json,
    "software": $software_json,
    "browserExtensions": $extensions_json,
    "patches": $patches_json,
    "agentVersion": "$AGENT_VERSION",
    "scanType": "inventory"
}
EOF
)
    
    log "Inventory collection completed:"
    log "- Software: $software_count packages"
    log "- Browser Extensions: $extensions_count extensions"
    log "- System Info: $os_name"
    
    # Submit to backend
    if submit_inventory_data "$inventory_data"; then
        echo
        echo -e "${GREEN}=========================================="
        echo "   ✓ Security Scan Completed Successfully"
        echo "==========================================${NC}"
        echo
        echo "Your Linux system has been scanned and the results"
        echo "have been securely sent to your Secure Habit dashboard."
        echo
        echo "🌐 Visit your dashboard to view:"
        echo "  - Security score and recommendations"
        echo "  - Detected vulnerabilities"
        echo "  - Software inventory"
        echo "  - System security posture"
        echo
        log "=== Secure Habit Linux Agent Completed Successfully ==="
    else
        echo
        echo -e "${RED}=========================================="
        echo "      ⚠ Security Scan Error"
        echo "==========================================${NC}"
        echo
        echo "The security scan encountered an issue."
        echo "This could be due to:"
        echo "  - Network connectivity problems"
        echo "  - Firewall blocking the connection"
        echo "  - Authentication issues"
        echo
        echo "Please check the log file: $LOG_FILE"
        echo "Or try running the agent again."
        echo
        log "=== Secure Habit Linux Agent Completed with Errors ==="
        exit 1
    fi
}

# Trap to ensure cleanup on exit
trap 'log "Agent execution finished"' EXIT

# Run main function
main "$@"
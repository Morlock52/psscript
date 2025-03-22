# Enhanced PowerShell script for AI Analysis Testing
# Author: Claude
# Version: 2.0
# Date: 2025-03-11

# Import necessary modules
Import-Module -Name Microsoft.PowerShell.Security
Import-Module -Name Microsoft.PowerShell.Utility

function Get-SystemInfo {
    <#
    .SYNOPSIS
        Gets comprehensive system information.
    
    .DESCRIPTION
        This function retrieves detailed system information including OS details,
        CPU, memory, disk space, network configuration, and running processes.
    
    .EXAMPLE
        Get-SystemInfo
        
        Returns complete system information for the local computer.
    
    .NOTES
        Requires administrator privileges for certain operations.
    #>
    
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$false)]
        [switch]$ExportToFile,
        
        [Parameter(Mandatory=$false)]
        [string]$OutputPath = "$env:USERPROFILE\Desktop\SystemInfo.json"
    )
    
    begin {
        Write-Verbose "Starting system information collection..."
        $results = @{}
    }
    
    process {
        try {
            # Get OS Information
            $osInfo = Get-CimInstance -ClassName Win32_OperatingSystem
            $results.OS = @{
                Name = $osInfo.Caption
                Version = $osInfo.Version
                BuildNumber = $osInfo.BuildNumber
                Architecture = $osInfo.OSArchitecture
                LastBootTime = $osInfo.LastBootUpTime
            }
            
            # Get CPU Information
            $cpuInfo = Get-CimInstance -ClassName Win32_Processor
            $results.CPU = @{
                Name = $cpuInfo.Name
                Cores = $cpuInfo.NumberOfCores
                LogicalProcessors = $cpuInfo.NumberOfLogicalProcessors
                MaxClockSpeed = $cpuInfo.MaxClockSpeed
                LoadPercentage = $cpuInfo.LoadPercentage
            }
            
            # Get Memory Information
            $memoryInfo = Get-CimInstance -ClassName Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum
            $totalMemoryGB = [math]::Round($memoryInfo.Sum / 1GB, 2)
            $freeMemory = [math]::Round(($osInfo.FreePhysicalMemory / 1MB), 2)
            $results.Memory = @{
                TotalGB = $totalMemoryGB
                FreeGB = $freeMemory
                UsedPercent = [math]::Round((($totalMemoryGB - $freeMemory) / $totalMemoryGB) * 100, 2)
            }
            
            # Get Disk Information
            $diskInfo = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=3"
            $results.Disks = @()
            foreach ($disk in $diskInfo) {
                $results.Disks += @{
                    Drive = $disk.DeviceID
                    SizeGB = [math]::Round($disk.Size / 1GB, 2)
                    FreeGB = [math]::Round($disk.FreeSpace / 1GB, 2)
                    UsedPercent = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 2)
                }
            }
            
            # Get Network Information
            $networkInfo = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration -Filter "IPEnabled='True'"
            $results.Network = @()
            foreach ($adapter in $networkInfo) {
                $results.Network += @{
                    Description = $adapter.Description
                    MACAddress = $adapter.MACAddress
                    IPAddresses = $adapter.IPAddress
                    Gateway = $adapter.DefaultIPGateway
                    DNSServers = $adapter.DNSServerSearchOrder
                }
            }
            
            # Get running processes
            $topProcesses = Get-Process | Sort-Object -Property CPU -Descending | Select-Object -First 5 -Property Name, CPU, WorkingSet
            $results.TopProcesses = @()
            foreach ($process in $topProcesses) {
                $results.TopProcesses += @{
                    Name = $process.Name
                    CPUUsage = [math]::Round($process.CPU, 2)
                    MemoryMB = [math]::Round($process.WorkingSet / 1MB, 2)
                }
            }
        }
        catch {
            Write-Error "Error collecting system information: $_"
            throw
        }
    }
    
    end {
        if ($ExportToFile) {
            try {
                $results | ConvertTo-Json -Depth 5 | Out-File -FilePath $OutputPath -Force
                Write-Output "System information exported to $OutputPath"
            }
            catch {
                Write-Error "Failed to export system information: $_"
            }
        }
        else {
            return $results
        }
    }
}

function Test-RemoteConnection {
    <#
    .SYNOPSIS
        Tests connectivity to remote systems.
    
    .DESCRIPTION
        This function tests connectivity to remote systems using ping and TCP port tests.
    
    .PARAMETER Targets
        Array of target hosts or IP addresses to test.
    
    .PARAMETER Ports
        Array of ports to test on each target.
    
    .EXAMPLE
        Test-RemoteConnection -Targets @("server1", "192.168.1.1") -Ports @(80, 443)
        
        Tests connectivity to server1 and 192.168.1.1 on ports 80 and 443.
    #>
    
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string[]]$Targets,
        
        [Parameter(Mandatory=$false)]
        [int[]]$Ports = @(80, 443, 3389)
    )
    
    $results = @{}
    
    foreach ($target in $Targets) {
        Write-Verbose "Testing connection to $target..."
        $pingResult = Test-Connection -ComputerName $target -Count 3 -Quiet
        
        $results[$target] = @{
            PingSuccess = $pingResult
            Ports = @{}
        }
        
        if ($pingResult) {
            foreach ($port in $Ports) {
                try {
                    $tcpClient = New-Object System.Net.Sockets.TcpClient
                    $portOpen = $tcpClient.ConnectAsync($target, $port).Wait(1000)
                    $results[$target].Ports[$port] = $portOpen
                }
                catch {
                    $results[$target].Ports[$port] = $false
                }
                finally {
                    if ($tcpClient) {
                        $tcpClient.Dispose()
                    }
                }
            }
        }
    }
    
    return $results
}

# Main script execution
if ($args.Count -gt 0 -and $args[0] -eq "-ExportSystemInfo") {
    Get-SystemInfo -ExportToFile -Verbose
}
elseif ($args.Count -gt 0 -and $args[0] -eq "-TestNetwork") {
    $defaultTargets = @("google.com", "microsoft.com", "github.com")
    Test-RemoteConnection -Targets $defaultTargets -Verbose
}
else {
    # Display help information
    $scriptInfo = @"
    
PowerShell System Diagnostic Tool
================================
This script provides system diagnostics and network testing functionality.

Commands:
---------
* -ExportSystemInfo : Collects and exports system information to Desktop
* -TestNetwork     : Tests connectivity to common internet services
* (no parameters)  : Displays this help information

Examples:
---------
.\test-script.ps1 -ExportSystemInfo
.\test-script.ps1 -TestNetwork

"@
    Write-Host $scriptInfo
}

# System Information Collector
# Gathers detailed information about the system

function Get-SystemDetails {
    $computerSystem = Get-CimInstance CIM_ComputerSystem
    $operatingSystem = Get-CimInstance CIM_OperatingSystem
    $processor = Get-CimInstance CIM_Processor
    $physicalMemory = Get-CimInstance CIM_PhysicalMemory | Measure-Object -Property Capacity -Sum
    $diskDrives = Get-CimInstance CIM_DiskDrive
    
    $systemInfo = [PSCustomObject]@{
        ComputerName = $computerSystem.Name
        Manufacturer = $computerSystem.Manufacturer
        Model = $computerSystem.Model
        OperatingSystem = $operatingSystem.Caption
        OSVersion = $operatingSystem.Version
        OSBuild = $operatingSystem.BuildNumber
        Processor = $processor.Name
        CPUCores = $processor.NumberOfCores
        MemoryGB = [math]::Round($physicalMemory.Sum / 1GB, 2)
        DiskCount = $diskDrives.Count
        TotalDiskSizeGB = [math]::Round(($diskDrives | Measure-Object -Property Size -Sum).Sum / 1GB, 2)
        LastBootTime = $operatingSystem.LastBootUpTime
        InstallDate = $operatingSystem.InstallDate
    }
    
    return $systemInfo
}

# Get system information
$systemInfo = Get-SystemDetails

# Display the results
$systemInfo | Format-List

# Optional: Export to file
# $systemInfo | Export-Csv -Path "$env:USERPROFILE\Desktop\SystemInfo.csv" -NoTypeInformation
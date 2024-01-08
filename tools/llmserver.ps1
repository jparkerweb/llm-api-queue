# Add Windows Forms for open file dialog
Add-Type -AssemblyName System.Windows.Forms

# Function to read INI file
function Read-IniFile ($filePath) {
    $ini = @{}
    switch -regex -file $filePath {
        "^\[(.+)\]$" {
            $section = $matches[1]
            $ini[$section] = @{}
        }
        "^(.+)=(.*)$" {
            $name, $value = $matches[1..2]
            $ini[$section][$name] = $value
        }
    }
    return $ini
}

# Function to write INI file
function Write-IniFile ($filePath, $ini) {
    $content = ""
    foreach ($section in $ini.Keys) {
        $content += "[$section]`r`n"
        foreach ($key in $ini[$section].Keys) {
            $content += "$key=$($ini[$section][$key])`r`n"
        }
    }
    Set-Content -Path $filePath -Value $content
}

# Path to the INI file
$iniFilePath = "./llmserver.ini"

# Load settings from INI file
$settings = @{}
if (Test-Path $iniFilePath) {
    $settings = Read-IniFile $iniFilePath
}

# Initialize Paths array if it doesn't exist
if (-not $settings.ContainsKey("Paths")) {
    $settings["Paths"] = @{}
}

# Function to open a file dialog and return the selected file path
function Select-File($title, $filter, $initialDirectory) {
    $fileDialog = New-Object System.Windows.Forms.OpenFileDialog
    $fileDialog.Title = $title
    $fileDialog.Filter = $filter
    if ($initialDirectory -and (Test-Path $initialDirectory)) {
        $fileDialog.InitialDirectory = $initialDirectory
    }
    $result = $fileDialog.ShowDialog()

    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        return $fileDialog.FileName
    } else {
        return $null
    }
}

# Ask user to select server.exe
$serverExePath = Select-File "Select server.exe" "server.exe|server.exe" $settings["Paths"]["ServerExe"]
if (-not $serverExePath) {
    Write-Host "No file selected for server.exe, exiting script."
    exit
} else {
    $settings["Paths"]["ServerExe"] = Split-Path $serverExePath
}

# Ask user to select a model file with .gguf extension
$modelFilePath = Select-File "Select a model file" "GGUF files (*.gguf)|*.gguf" $settings["Paths"]["ModelFile"]
if (-not $modelFilePath) {
    Write-Host "No file selected for the model file, exiting script."
    exit
} else {
    $settings["Paths"]["ModelFile"] = Split-Path $modelFilePath
}

# Save settings to INI file
Write-IniFile $iniFilePath $settings

# Ask user for context size with a default value of 2048
$contextSize = Read-Host "Enter context size (default is 2048)"
if (-not $contextSize) {
    $contextSize = 2048
}

# Ask user for the number of simultaneous requests with a default value of 2
$simultaneousRequests = Read-Host "Enter number of simultaneous requests (default is 2)"
if (-not $simultaneousRequests) {
    $simultaneousRequests = 2
}

# Ask user for host with a default value of 127.0.0.1
$serverHost = Read-Host "Enter host (default is 127.0.0.1)"
if (-not $serverHost) {
    $serverHost = "127.0.0.1"
}

# Ask user for port with a default value of 8080
$serverPort = Read-Host "Enter port (default is 8080)"
if (-not $serverPort) {
    $serverPort = 8080
}

# Construct and run the command
$command = "& `"$serverExePath`" -m `"$modelFilePath`" -c $contextSize -cb -np $simultaneousRequests --host $serverHost --port $serverPort"
Invoke-Expression $command

# ==============================================
# == Download the latest version of llama.cpp ==
# ==============================================
# This script will download and extract the latest version of llama.cpp from
# https://github.com/ggerganov/llama.cpp/releases


# Define the path for the .ini file
$iniFile = "download-latest-llama.ini"

# Function to read the last used directory from the ini file
function Read-LastUsedDirectory {
    if (Test-Path $iniFile) {
        return Get-Content $iniFile
    } else {
        return $null
    }
}

# Function to save the selected directory to the ini file
function Save-LastUsedDirectory($directory) {
    $directory | Set-Content $iniFile
}

# Print a message and wait for user to press Enter
Write-Host ""
Write-Host "This script will download and extract the latest version of llama.cpp"
Write-Host "from → https://github.com/ggerganov/llama.cpp/releases'"
Write-Host ""
Write-Host "You will be asked to a version targeting your hardware capabilities and target directory"
Write-Host "Please press Enter to continue, or Ctrl + C to exit..."
Read-Host

# Present options for CPU version
Write-Host ""
Write-Host "------------------------------------------------------------------------------------"
Write-Host "Select the version of the file to download:"
Write-Host "The 'avx' option run on CPU only."
Write-Host "You can download CPU-Z from the following website"
Write-Host "which will show you what CPU Instructions you"
Write-Host "have available: https://www.cpuid.com/softwares/cpu-z.html"
Write-Host "or choose a 'cu' option to use the GPU. visit"
Write-Host "https://github.com/ggerganov/llama.cpp for more information."
Write-Host ""
Write-Host "1) avx"
Write-Host "2) avx2"
Write-Host "3) avx512"
Write-Host "4) clblast"
Write-Host "5) cublas-cu11.7.1"
Write-Host "6) cublas-cu12.2.0"
Write-Host "7) noavx"
Write-Host "8) openblas"
$choice = Read-Host "Enter your choice (1, 2, 3, 4, 5, 6, 7 or 8)"

# Map user choice to CPU version
switch ($choice) {
    "1" { $cpuVersion = "avx" }
    "2" { $cpuVersion = "avx2" }
    "3" { $cpuVersion = "avx512" }
    "4" { $cpuVersion = "clblast" }
    "5" { $cpuVersion = "cublas-cu11.7.1" }
    "6" { $cpuVersion = "cublas-cu12.2.0" }
    "7" { $cpuVersion = "noavx" }
    "8" { $cpuVersion = "openblas" }
    default { 
        Write-Error "Invalid choice. Exiting script."
        exit
    }
}

# Add .NET assembly for Windows Forms
Add-Type -AssemblyName System.Windows.Forms

# Check if there's a previously used directory
$lastUsedDirectory = Read-LastUsedDirectory

# Create a FolderBrowserDialog object
$folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
$folderBrowser.Description = "Select a target directory"
if ($lastUsedDirectory -ne $null -and (Test-Path $lastUsedDirectory)) {
    $folderBrowser.SelectedPath = $lastUsedDirectory
}
$folderBrowser.ShowDialog() | Out-Null
$targetDirectory = $folderBrowser.SelectedPath

# Save the selected directory for future use
if ($targetDirectory -ne '') {
    Save-LastUsedDirectory $targetDirectory

    # GitHub API URL for the latest release
    $apiUrl = "https://api.github.com/repos/ggerganov/llama.cpp/releases/latest"

    # Use Invoke-RestMethod to get the latest release data
    $latestRelease = Invoke-RestMethod -Uri $apiUrl -Headers @{"Accept"="application/vnd.github.v3+json"}

    # Extract the tag name
    $tagName = $latestRelease.tag_name

    # Construct the download URL
    $downloadUrl = "https://github.com/ggerganov/llama.cpp/releases/download/$tagName/llama-$tagName-bin-win-$cpuVersion-x64.zip"

    # Define the local zip file path
    $zipFileName = "llama-$tagName-bin-win-$cpuVersion-x64.zip"
    $zipFile = Join-Path $targetDirectory $zipFileName

    # Download the zip file
    Write-Host ""
    Write-Host "------------------------------------------------------------------------------------"
    Write-Host "Downloading $cpuVersion CPU version from:"
    Write-Host "https://github.com/ggerganov/llama.cpp/releases/$tagName"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipFile

    # Extract the zip file contents to the selected target directory
    Write-Host "------------------------------------------------------------------------------------"
    Write-Host "Extracting >> $zipFile"
    Expand-Archive -LiteralPath $zipFile -DestinationPath $targetDirectory -Force

    # Remove the downloaded zip file (optional)
    Write-Host "------------------------------------------------------------------------------------"
    Write-Host "Deleting temp zip file >> $zipFile"
    Remove-Item -Path $zipFile

    Write-Host "------------------------------------------------------------------------------------"
    Write-Host "Latest version of llama.cpp is downloaded and ready for use!"
    Write-Host "Have a great day :)"
    Write-Host ""
} else {
    Write-Host "No directory selected. Exiting script."
}
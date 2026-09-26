@echo off
setlocal EnableDelayedExpansion

title Spicetify Setup
cls
echo.
echo ============================================================================
echo                         Spicetify Setup Script
echo ============================================================================
echo.

set "PWSH="
for %%P in (pwsh.exe powershell.exe) do (
    where %%P >nul 2>&1 && (set "PWSH=%%P" & goto :found_ps)
)
echo [ERROR] PowerShell not found.
pause
exit /b 1

:found_ps
echo [INFO] Using: %PWSH%
echo.

echo [STEP 1] Checking installation...
where spicetify >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing Spicetify...
    %PWSH% -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/install.ps1 -OutFile '%TEMP%\spicetify-install.ps1'; & '%TEMP%\spicetify-install.ps1'; Remove-Item '%TEMP%\spicetify-install.ps1' -ErrorAction SilentlyContinue"
    
    set "PATH=%PATH%;%USERPROFILE%\.spicetify;%APPDATA%\spicetify"
    
    echo [INFO] Installing Marketplace...
    %PWSH% -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "iwr -useb https://raw.githubusercontent.com/spicetify/marketplace/main/resources/install.ps1 -OutFile '%TEMP%\marketplace-install.ps1'; & '%TEMP%\marketplace-install.ps1'; Remove-Item '%TEMP%\marketplace-install.ps1' -ErrorAction SilentlyContinue"
) else (
    echo [OK] Spicetify is installed.
)

echo.
echo [STEP 2] Checking for updates...
for /f "tokens=*" %%V in ('spicetify -v 2^>nul') do set "LOCAL_VER=%%V"
if not defined LOCAL_VER set "LOCAL_VER=Unknown"

echo [INFO] Local version: %LOCAL_VER%
echo [STEP 3] Ensuring latest version...
spicetify upgrade

echo.
echo [STEP 4] Optional features...
echo          Install SpicyLyricTranslate plugin?
choice /c YN /n /m "          Install? (Y/N) "
if errorlevel 2 goto :skip_plugin

echo.
echo [STEP 5] Downloading SpicyLyricTranslate...

set "PS_SCRIPT=%TEMP%\spicetify_plugin_install.ps1"

(
    echo $ErrorActionPreference = 'Stop'
    echo $filename = "spicy-lyric-translater.js"
    echo $extDir = "$env:APPDATA\spicetify\Extensions"
    echo $downloadUrl = "https://7xeh.dev/apps/spicylyrictranslate/api/version.php?action=loader"
    echo.
    echo if ^(-not ^(Test-Path $extDir^)^) { New-Item -ItemType Directory -Path $extDir -Force ^| Out-Null }
    echo.
    echo try {
    echo     Write-Host "Downloading SpicyLyricTranslate Loader..."
    echo     Invoke-WebRequest -Uri $downloadUrl -OutFile "$extDir\$filename"
    echo     Write-Host "Success: Downloaded SpicyLyricTranslate."
    echo } catch {
    echo     Write-Error "Download failed: $_"
    echo     exit 1
    echo }
) > "%PS_SCRIPT%"

%PWSH% -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"

if %errorlevel% neq 0 (
    echo [ERROR] Download failed.
    del "%PS_SCRIPT%" >nul 2>&1
    pause
    goto :skip_plugin
)

del "%PS_SCRIPT%" >nul 2>&1

spicetify config extensions spicy-lyric-translater.js
echo [OK] Extension registered.

:skip_plugin
echo.

echo [STEP 6] Applying changes...
taskkill /im Spotify.exe /f >nul 2>&1
timeout /t 2 >nul

echo [INFO] Attempting fast apply...
call spicetify apply

if %errorlevel% equ 0 goto :launch

echo.
echo [WARN] Fast apply failed (Spotify likely updated).
echo [INFO] Performing full restore and re-backup...
echo.

call spicetify restore backup apply

:launch
echo.
echo [INFO] Launching Spotify...
start "" "spotify:"

echo.
echo ============================================================================
echo                              COMPLETE
echo ============================================================================
pause
exit /b 0
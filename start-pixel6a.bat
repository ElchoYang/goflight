@echo off
chcp 65001 >nul
setlocal

set "AVD_NAME=Pixel_6a"
set "DNS_SERVERS=8.8.8.8,114.114.114.114"

set "EMU_EXE="
if defined ANDROID_HOME if exist "%ANDROID_HOME%\emulator\emulator.exe" set "EMU_EXE=%ANDROID_HOME%\emulator\emulator.exe"
if not defined EMU_EXE if defined ANDROID_SDK_ROOT if exist "%ANDROID_SDK_ROOT%\emulator\emulator.exe" set "EMU_EXE=%ANDROID_SDK_ROOT%\emulator\emulator.exe"
if not defined EMU_EXE if exist "%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" set "EMU_EXE=%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe"

if not defined EMU_EXE (
  echo [ERROR] 未找到 emulator.exe，请检查 ANDROID_HOME 或 Android SDK 安装路径。
  pause
  exit /b 1
)

echo 正在启动 %AVD_NAME% （DNS: %DNS_SERVERS%）...
start "" "%EMU_EXE%" -avd "%AVD_NAME%" -dns-server "%DNS_SERVERS%"

endlocal
@echo off
REM =====================================================================
REM  Colorable — Play Store release build (run from the repo root)
REM  Produces: android\app\build\outputs\bundle\release\app-release.aab
REM =====================================================================
setlocal
cd /d "%~dp0"

echo [1/3] Building web bundle (vite)...
call npm run build
if errorlevel 1 goto :fail

echo [2/3] Syncing web bundle into the Android project (capacitor)...
call npx cap sync android
if errorlevel 1 goto :fail

echo [3/3] Building signed release .aab (gradle)...
cd android
call gradlew.bat bundleRelease
if errorlevel 1 goto :fail
cd ..

echo.
echo =====================================================================
echo  SUCCESS!
echo  Upload this file to Play Console (Release ^> Production ^> Create):
echo    android\app\build\outputs\bundle\release\app-release.aab
echo =====================================================================
exit /b 0

:fail
echo.
echo BUILD FAILED — see the error above.
exit /b 1

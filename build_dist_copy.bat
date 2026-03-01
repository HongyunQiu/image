@echo off
setlocal enabledelayedexpansion
REM Keep output ASCII-only for cmd compatibility
chcp 65001 >nul

echo Start building editorjs-image (@editorjs/image)...
echo.

REM Dependency check: Vite present => node_modules\vite
if not exist "node_modules\vite" (
    echo node_modules/vite not found; running npm install --legacy-peer-deps...
    call npm install --legacy-peer-deps
    set INSTALL_RESULT=!ERRORLEVEL!
    if !INSTALL_RESULT! NEQ 0 (
        echo npm install failed. Exit code: !INSTALL_RESULT!
        echo.
        if /I "%~1" NEQ "--no-pause" (
            pause
        )
        exit /b !INSTALL_RESULT!
    )
    echo npm install completed.
    echo.
)

call npm run build
set BUILD_RESULT=!ERRORLEVEL!

echo.
echo Build finished. Exit code: !BUILD_RESULT!

if !BUILD_RESULT! NEQ 0 (
    echo Build failed. Exit code: !BUILD_RESULT!
    echo.
    if /I "%~1" NEQ "--no-pause" (
        pause
    )
    exit /b !BUILD_RESULT!
)

echo Build succeeded; copying files...
echo.

set SRC_DIR=dist
set DEST_DIR=..\..\QNotes\public\vendor\editorjs-image

if not exist "!SRC_DIR!\" (
    echo ERROR: folder not found: !SRC_DIR!\
    echo Make sure "npm run build" generates a dist folder.
    echo.
    if /I "%~1" NEQ "--no-pause" (
        pause
    )
    exit /b 1
)

REM Minimal check: UMD build output for browser usage
if not exist "!SRC_DIR!\image.umd.js" (
    echo ERROR: file not found: !SRC_DIR!\image.umd.js
    echo Make sure Vite lib build output is configured correctly.
    echo.
    if /I "%~1" NEQ "--no-pause" (
        pause
    )
    exit /b 1
)

if not exist "!DEST_DIR!" (
    echo Creating target folder: !DEST_DIR!
    mkdir "!DEST_DIR!"
    set MKDIR_RESULT=!ERRORLEVEL!
    if !MKDIR_RESULT! NEQ 0 (
        echo Failed to create folder. Exit code: !MKDIR_RESULT!
        echo.
        if /I "%~1" NEQ "--no-pause" (
            pause
        )
        exit /b !MKDIR_RESULT!
    )
    echo Target folder created.
)

echo Copying all files from !SRC_DIR!\ to: !DEST_DIR!
xcopy /E /I /Y "!SRC_DIR!\*" "!DEST_DIR!\" >nul
set COPY_RESULT=!ERRORLEVEL!

if !COPY_RESULT! GEQ 4 (
    echo Copy failed. Exit code: !COPY_RESULT!
    echo.
    if /I "%~1" NEQ "--no-pause" (
        pause
    )
    exit /b !COPY_RESULT!
) else (
    echo Copy succeeded.
)

echo.
echo ========================================
echo Done. editorjs-image build artifacts copied.
echo Target folder: !DEST_DIR!
echo Key file: !DEST_DIR!\image.umd.js
echo ========================================

if /I "%~1" NEQ "--no-pause" (
    pause
)

exit /b 0


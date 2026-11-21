@echo off
rem MenMen Workflow - installer for Windows. Double-click this file.
rem 1) allows unsigned extensions in After Effects 2022-2026 (PlayerDebugMode for CSXS 9-13)
rem 2) copies this folder to %APPDATA%\Adobe\CEP\extensions\com.menmen.workflow
rem    (existing files are replaced, your own scripts in library\ are kept)
setlocal
set "SRC=%~dp0"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.menmen.workflow"

echo MenMen Workflow installer
echo -------------------------
if not exist "%SRC%\CSXS\manifest.xml" (
  echo ERROR: run this file from inside the MenMen Workflow folder ^(CSXS\manifest.xml not found^).
  pause & exit /b 1
)

for %%v in (9 10 11 12 13) do reg add "HKCU\Software\Adobe\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
echo OK  Unsigned extensions allowed (CSXS 9-13)

if /i "%SRC%"=="%DEST%" goto done
robocopy "%SRC%" "%DEST%" /E /NFL /NDL /NJH /NJS /NP /R:2 /W:1 >nul
if errorlevel 8 (
  echo ERROR: copying to %DEST% failed. Close After Effects and try again.
  pause & exit /b 1
)
echo OK  Copied to %DEST%

:done
echo.
echo Done. Quit After Effects completely, open it again, then Window ^> Extensions ^> MenMen Workflow.
pause

@echo off
pushd %~dp0

if not exist .git (
  GOTO:notgit
)

where /q git.exe
if %ERRORLEVEL% EQU 0 (
  GOTO:pull
)
GOTO:missgit


:pull
call git config --local url."https://".insteadOf git://
call git config --local url."https://github.com/".insteadOf git@github.com:
call git config --local url."https://".insteadOf ssh://
call git pull --rebase --autostash
if %ERRORLEVEL% neq 0 (
  echo Error updating
)
GOTO:end

:missgit
echo Install git to update
GOTO:end

:notgit
echo Only able to update if you clone the repository (git clone https://github.com/teralomaniac/clewd.git)
GOTO:end


:end
pause
popd
exit /B
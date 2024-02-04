pushd %~dp0
call npm install --no-audit --fund false
node clewd.js
pause
popd
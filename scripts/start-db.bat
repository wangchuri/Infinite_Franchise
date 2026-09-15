@echo off
setlocal
set "PGBIN=D:\development\env\PostgreSQL\bin"
set "PGDATA=D:\development\env\PostgreSQL\data"

if not exist "%PGBIN%\pg_ctl.exe" (
  echo [error] pg_ctl.exe not found at "%PGBIN%"
  exit /b 1
)

"%PGBIN%\pg_ctl.exe" status -D "%PGDATA%" >nul 2>&1
if %errorlevel%==0 (
  echo PostgreSQL is already running.
  exit /b 0
)

if exist "%PGDATA%\postmaster.pid" (
  echo [warn] removing stale postmaster.pid
  del /f /q "%PGDATA%\postmaster.pid"
)

echo Starting PostgreSQL...
"%PGBIN%\pg_ctl.exe" start -D "%PGDATA%"
if errorlevel 1 (
  echo [error] failed to start PostgreSQL
  exit /b 1
)
echo PostgreSQL started.

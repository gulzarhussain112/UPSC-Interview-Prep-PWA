@echo off
cd /d "%~dp0"
echo Starting UPSC Interview Prep at http://localhost:8080/
start "" http://localhost:8080/
python -m http.server 8080
pause

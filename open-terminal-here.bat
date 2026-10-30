@echo off
:: HOME MONI - Open PowerShell terminal at project root
:: Double-click this file to open a terminal at the correct project directory

cd /d "D:\NTT-2026\dev.app\fin.ais.tracking-moni"
powershell.exe -NoExit -WorkingDirectory "D:\NTT-2026\dev.app\fin.ais.tracking-moni" -Command "Write-Host 'HOME MONI Terminal Ready' -ForegroundColor Green; Write-Host 'D:\NTT-2026\dev.app\fin.ais.tracking-moni' -ForegroundColor Cyan"

@echo off
rem 只需运行一次：以后每次 git pull / 切换分支 / 合并后，自动重新生成 viewer/index.html
cd /d "%~dp0.."
git config core.hooksPath .githooks
echo 已启用自动生成（git config core.hooksPath .githooks）
call scripts\build.bat

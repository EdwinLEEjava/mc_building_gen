@echo off
rem 生成 web/mcgen.js、web/mcgen_data.json、viewer/index.html（这些文件不进 git，拉取代码后运行一次）
cd /d "%~dp0.."
where py >nul 2>nul && (py -3 build_viewer.py & goto :eof)
python build_viewer.py

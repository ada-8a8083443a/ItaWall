@echo off
chcp 65001 >nul
title 赛博痛墙 - 本地服务器

echo.
echo ╔══════════════════════════════════════════╗
echo ║       赛博痛墙 - Cyber Ita Wall           ║
echo ║       本地服务器启动中...                   ║
echo ╚══════════════════════════════════════════╝
echo.

REM 检查端口是否被占用
netstat -ano | findstr ":8080" | findstr LISTENING >nul
if %errorlevel%==0 (
    echo [警告] 端口 8080 已被占用，正在尝试关闭...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)

REM 查找可用的 Python 命令
where python >nul 2>&1
if %errorlevel%==0 (
    set PYTHON_CMD=python
) else (
    where py >nul 2>&1
    if %errorlevel%==0 (
        set PYTHON_CMD=py
    ) else (
        echo.
        echo [错误] 未找到 Python！请先安装 Python 3。
        echo 下载地址: https://www.python.org/downloads/
        echo.
        echo 或者你也可以直接双击 index.html 打开。
        echo.
        pause
        exit /b 1
    )
)

echo [信息] 使用 %PYTHON_CMD% 启动服务器
echo [信息] 本地地址: http://localhost:8080
echo [信息] 按 Ctrl+C 停止服务器
echo.

REM 自动打开浏览器
start "" "http://localhost:8080"

REM 启动 HTTP 服务器
%PYTHON_CMD% -m http.server 8080

pause

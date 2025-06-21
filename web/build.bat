@echo off
REM 设置内存限制
set NODE_OPTIONS=--max_old_space_size=16384 --optimize-for-size

REM 清理缓存
echo 清理构建缓存...
if exist node_modules\.vite rmdir /s /q node_modules\.vite
if exist dist rmdir /s /q dist

REM 安装依赖（如果需要）
if not exist node_modules (
    echo 安装依赖...
    bun install
)

REM 构建项目
echo 开始构建...
set DISABLE_ESLINT_PLUGIN=true
for /f %%i in (..\VERSION) do set VITE_REACT_APP_VERSION=%%i
bun run build

echo 构建完成！
pause

#!/bin/bash

# 设置内存限制
export NODE_OPTIONS="--max_old_space_size=16384 --optimize-for-size"

# 清理缓存
echo "清理构建缓存..."
rm -rf node_modules/.vite
rm -rf dist

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    bun install
fi

# 构建项目
echo "开始构建..."
DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat ../VERSION) bun run build

echo "构建完成！"

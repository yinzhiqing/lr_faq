#!/bin/bash
set -e

echo "=== 产品知识库 - 部署脚本 ==="

# 检查 Node.js
if ! command -v node &>/dev/null; then
    echo "错误: 未安装 Node.js (需要 >= 18)"
    exit 1
fi
echo "Node.js $(node -v)"

# 检查 ffmpeg（可选）
if command -v ffmpeg &>/dev/null; then
    echo "ffmpeg 已安装"
else
    echo "提示: 未安装 ffmpeg，视频自动转码功能不可用"
fi

# 安装依赖
echo "安装依赖..."
npm install --production

# 创建必要目录
mkdir -p uploads

# 生产环境请设置 SESSION_SECRET；置于反向代理后建议 TRUST_PROXY=1
if [ "${NODE_ENV:-}" = "production" ] && [ -z "${SESSION_SECRET:-}" ]; then
    echo "错误: 生产环境请设置 SESSION_SECRET"
    exit 1
fi

# 启动服务
PORT=${PORT:-3000}
echo "启动服务 (端口: $PORT)..."
echo "健康检查: http://localhost:$PORT/health"
node server.js

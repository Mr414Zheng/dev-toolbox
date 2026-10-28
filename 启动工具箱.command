#!/bin/zsh -l

# Finder 双击时也固定到项目目录，兼容路径中的空格。
cd -- "${0:A:h}" || exit 1
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"

fail() {
  print -r -- "$1"
  read -r "?按回车键关闭窗口…"
  exit 1
}

command -v node >/dev/null 2>&1 || fail '未找到 Node.js，请先安装 Node.js 24，再双击此文件。'
command -v npm >/dev/null 2>&1 || fail '未找到 npm，请检查 Node.js 安装。'

if [[ ! -f node_modules/vite/bin/vite.js ]]; then
  print '首次启动：正在安装项目依赖，请稍候…'
  npm ci || fail '依赖安装失败，请检查网络后重新双击启动。'
fi

print '正在打开 dev-toolbox 开发者工具箱…'
print '请保留此窗口。关闭窗口或按 Control+C 可停止服务。'
print ''
npm run dev -- --open
status_code=$?
if (( status_code != 0 && status_code != 130 )); then
  fail '启动未完成，请查看上方提示。'
fi

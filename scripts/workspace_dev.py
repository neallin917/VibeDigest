#!/usr/bin/env python3
"""
Workspace Dev Launcher (V3) - 无文件污染的 Next.js 启动器

功能：
1. 读取 .workspace.json 作为单一事实来源
2. 通过 Git 语义校验工作区身份
3. 检查端口冲突（冲突时报错退出，不自动更换）
4. 内存级环境变量注入（不修改 .env 文件）
"""

import json
import os
import socket
import subprocess
import sys
from pathlib import Path


def get_git_root() -> Path | None:
    """获取当前 Git 仓库根目录"""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True,
        )
        return Path(result.stdout.strip())
    except subprocess.CalledProcessError:
        return None


def load_workspace_config(git_root: Path) -> dict:
    """加载 .workspace.json 配置"""
    config_path = git_root / ".workspace.json"
    if not config_path.exists():
        print(f"❌ 错误：未找到 {config_path}")
        print("   请确保项目根目录包含 .workspace.json 文件")
        sys.exit(1)

    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def check_port_available(port: int) -> tuple[bool, str | None]:
    """
    检查端口是否可用
    返回: (是否可用, 占用进程信息)
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(1)
    try:
        sock.bind(("127.0.0.1", port))
        sock.close()
        return True, None
    except OSError:
        sock.close()
        # 尝试获取占用进程信息
        try:
            result = subprocess.run(
                ["lsof", "-i", f":{port}", "-t"],
                capture_output=True,
                text=True,
            )
            pids = result.stdout.strip().split("\n")
            if pids and pids[0]:
                # 获取进程名
                ps_result = subprocess.run(
                    ["ps", "-p", pids[0], "-o", "comm="],
                    capture_output=True,
                    text=True,
                )
                process_name = ps_result.stdout.strip()
                return False, f"PID {pids[0]} ({process_name})"
        except Exception:
            pass
        return False, "未知进程"


def main():
    print("🚀 Workspace Dev Launcher (V3)")
    print("=" * 50)

    # 1. Git 语义校验
    git_root = get_git_root()
    if not git_root:
        print("❌ 错误：当前目录不在 Git 仓库中")
        sys.exit(1)

    print(f"📁 Git 根目录: {git_root}")

    # 2. 加载配置
    config = load_workspace_config(git_root)
    workspace_id = config.get("workspace_id", "unknown")
    workspace_type = config.get("type", "unknown")
    frontend_port = config.get("frontend_port", 3000)
    backend_url = config.get("backend_url", "http://localhost:16081")

    print(f"🏷️  Workspace: {workspace_id} ({workspace_type})")
    print(f"🌐 前端端口: {frontend_port}")
    print(f"📡 后端 API: {backend_url}")

    # 3. 端口检查
    available, process_info = check_port_available(frontend_port)
    if not available:
        print(f"\n❌ 端口 {frontend_port} 已被占用: {process_info}")
        print("⚠️  严禁自动更换端口！请手动处理端口冲突：")
        print(f"   - 终止占用进程: kill $(lsof -t -i:{frontend_port})")
        print("   - 或修改 .workspace.json 中的 frontend_port")
        sys.exit(1)

    print(f"✅ 端口 {frontend_port} 可用")

    # 4. 内存级环境注入
    env = os.environ.copy()
    env["PORT"] = str(frontend_port)
    env["NEXT_PUBLIC_API_URL"] = backend_url
    env["WORKSPACE_ID"] = workspace_id

    # 5. 启动 Next.js
    frontend_dir = git_root / "frontend"
    if not frontend_dir.exists():
        print(f"❌ 错误：未找到 frontend 目录: {frontend_dir}")
        sys.exit(1)

    print("\n" + "=" * 50)
    print(f"🎯 启动 Next.js (端口 {frontend_port})...")
    print("=" * 50 + "\n")

    try:
        # 使用 npx next dev 确保使用项目本地的 next
        subprocess.run(
            ["npx", "next", "dev", "-p", str(frontend_port)],
            cwd=frontend_dir,
            env=env,
        )
    except KeyboardInterrupt:
        print("\n\n👋 开发服务器已停止")
    except FileNotFoundError:
        print("❌ 错误：未找到 npx 命令，请确保 Node.js 已安装")
        sys.exit(1)


if __name__ == "__main__":
    main()

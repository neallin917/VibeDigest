#!/usr/bin/env python3
"""
Worktree Manager - Git Worktree 管理工具

功能：
1. create <branch> [port] - 创建新的 worktree 并自动配置
2. list                   - 列出所有 worktree 及其配置
3. remove <name>          - 删除指定 worktree

端口分配策略：
- 主目录: 3000
- Worktree: 3001, 3002, ... (自动分配下一个可用端口)
"""

import argparse
import json
import os
import re
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


def sanitize_branch_name(branch: str) -> str:
    """将分支名转换为安全的目录名"""
    # 移除危险字符，将 / 替换为 -
    safe_name = re.sub(r"[^\w\-]", "-", branch.replace("/", "-"))
    return safe_name


def scan_existing_ports(parent_dir: Path) -> set[int]:
    """扫描现有 worktree 使用的端口"""
    ports = set()
    for item in parent_dir.iterdir():
        if item.is_dir() and item.name.startswith("AI-Video-Transcriber"):
            config_path = item / ".workspace.json"
            if config_path.exists():
                try:
                    with open(config_path, "r") as f:
                        config = json.load(f)
                        port = config.get("frontend_port")
                        if port:
                            ports.add(port)
                except (json.JSONDecodeError, IOError):
                    pass
    return ports


def get_next_available_port(parent_dir: Path, start: int = 3001) -> int:
    """获取下一个可用端口"""
    used_ports = scan_existing_ports(parent_dir)
    port = start
    while port in used_ports:
        port += 1
    return port


def create_worktree(branch: str, port: int | None = None):
    """创建新的 worktree"""
    git_root = get_git_root()
    if not git_root:
        print("❌ 错误：当前目录不在 Git 仓库中")
        sys.exit(1)

    parent_dir = git_root.parent
    safe_name = sanitize_branch_name(branch)
    worktree_dir = parent_dir / f"AI-Video-Transcriber-{safe_name}"

    if worktree_dir.exists():
        print(f"❌ 错误：目录已存在: {worktree_dir}")
        sys.exit(1)

    # 自动分配端口
    if port is None:
        port = get_next_available_port(parent_dir)

    print(f"🚀 创建 Worktree: {branch}")
    print(f"📁 目录: {worktree_dir}")
    print(f"🌐 端口: {port}")

    # 1. 创建 worktree
    try:
        subprocess.run(
            ["git", "worktree", "add", str(worktree_dir), branch],
            check=True,
        )
    except subprocess.CalledProcessError as e:
        print(f"❌ Git worktree 创建失败: {e}")
        sys.exit(1)

    # 2. 创建 .workspace.json
    config = {
        "workspace_id": safe_name,
        "type": "worktree",
        "frontend_port": port,
        "backend_url": "http://localhost:16081",
    }

    config_path = worktree_dir / ".workspace.json"
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Worktree 创建完成!")
    print(f"📁 路径: {worktree_dir}")
    print(f"🌐 前端端口: {port}")
    print(f"📡 后端 API: http://localhost:16081")
    print(f"\n启动命令:")
    print(f"  cd {worktree_dir}/frontend && npm install && npm run dev")


def list_worktrees():
    """列出所有 worktree"""
    git_root = get_git_root()
    if not git_root:
        print("❌ 错误：当前目录不在 Git 仓库中")
        sys.exit(1)

    parent_dir = git_root.parent

    print("📋 Worktree 列表:")
    print("=" * 60)

    for item in sorted(parent_dir.iterdir()):
        if item.is_dir() and item.name.startswith("AI-Video-Transcriber"):
            config_path = item / ".workspace.json"
            if config_path.exists():
                try:
                    with open(config_path, "r") as f:
                        config = json.load(f)
                    ws_id = config.get("workspace_id", "?")
                    ws_type = config.get("type", "?")
                    port = config.get("frontend_port", "?")
                    print(f"  {item.name}")
                    print(f"    ID: {ws_id} | Type: {ws_type} | Port: {port}")
                except (json.JSONDecodeError, IOError):
                    print(f"  {item.name}")
                    print(f"    ⚠️ 无法读取 .workspace.json")
            else:
                print(f"  {item.name}")
                print(f"    ⚠️ 缺少 .workspace.json")

    print("=" * 60)


def remove_worktree(name: str):
    """删除 worktree"""
    git_root = get_git_root()
    if not git_root:
        print("❌ 错误：当前目录不在 Git 仓库中")
        sys.exit(1)

    parent_dir = git_root.parent
    worktree_dir = parent_dir / name

    if not worktree_dir.exists():
        # 尝试添加前缀
        worktree_dir = parent_dir / f"AI-Video-Transcriber-{name}"

    if not worktree_dir.exists():
        print(f"❌ 错误：未找到 worktree: {name}")
        sys.exit(1)

    print(f"🗑️  删除 Worktree: {worktree_dir}")

    try:
        subprocess.run(
            ["git", "worktree", "remove", str(worktree_dir)],
            check=True,
        )
        print("✅ Worktree 已删除")
    except subprocess.CalledProcessError as e:
        print(f"❌ 删除失败: {e}")
        print("提示: 如果有未提交的更改，请使用 --force 参数")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Git Worktree 管理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s create feature/new-ui       # 创建新 worktree (自动分配端口)
  %(prog)s create feature/new-ui 3002  # 创建新 worktree (指定端口)
  %(prog)s list                        # 列出所有 worktree
  %(prog)s remove feature-new-ui       # 删除 worktree
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # create 命令
    create_parser = subparsers.add_parser("create", help="创建新的 worktree")
    create_parser.add_argument("branch", help="分支名称")
    create_parser.add_argument("port", nargs="?", type=int, help="前端端口 (可选)")

    # list 命令
    subparsers.add_parser("list", help="列出所有 worktree")

    # remove 命令
    remove_parser = subparsers.add_parser("remove", help="删除 worktree")
    remove_parser.add_argument("name", help="Worktree 名称或目录名")

    args = parser.parse_args()

    if args.command == "create":
        create_worktree(args.branch, args.port)
    elif args.command == "list":
        list_worktrees()
    elif args.command == "remove":
        remove_worktree(args.name)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
AI-Video-Transcriber 每日运营日报
- 新注册用户数 (profiles.created_at)
- DAU (chat_threads.user_id 昨日去重)
- Task 生成数 (tasks.created_at)
- Thread 生成数 (chat_threads.created_at)
- 任务失败数 (tasks.status = 'error')

运行方式：
  # 仅输出 JSON（供 OpenClaw cron agent 读取）
  python scripts/daily_report.py

  # 同时发送到飞书 webhook（可选）
  FEISHU_WEBHOOK_URL=https://... python scripts/daily_report.py
"""

import os
import sys
import json
import httpx
from datetime import datetime, timedelta, timezone
from supabase import create_client, Client

# ── 配置 ────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]   # service_role key，bypasses RLS
FEISHU_WEBHOOK_URL = os.environ.get("FEISHU_WEBHOOK_URL")   # 可选

# 统计范围：昨天 00:00 ~ 23:59:59 (CST = UTC+8)
CST = timezone(timedelta(hours=8))

def get_yesterday_range():
    today_cst = datetime.now(CST).replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_cst - timedelta(days=1)
    yesterday_end   = today_cst - timedelta(seconds=1)
    return (
        yesterday_start.astimezone(timezone.utc).isoformat(),
        yesterday_end.astimezone(timezone.utc).isoformat(),
        yesterday_start.strftime("%Y-%m-%d"),
    )

def fetch_metrics(sb: Client, start: str, end: str) -> dict:
    # 1. 新注册用户数（profiles 自动跟随 auth.users 创建）
    new_users = sb.table("profiles")\
        .select("id", count="exact")\
        .gte("created_at", start)\
        .lte("created_at", end)\
        .execute()
    new_user_count = new_users.count or 0

    # 2. DAU：昨日在 chat_threads 中有活动的去重 user_id 数
    #    注：tasks 也可以作为活跃信号，当前以 chat_threads 为准
    dau_result = sb.table("chat_threads")\
        .select("user_id")\
        .gte("updated_at", start)\
        .lte("updated_at", end)\
        .execute()
    dau = len(set(r["user_id"] for r in (dau_result.data or [])))

    # 3. Task 生成数（排除 demo task）
    new_tasks = sb.table("tasks")\
        .select("id", count="exact")\
        .gte("created_at", start)\
        .lte("created_at", end)\
        .eq("is_demo", False)\
        .execute()
    new_task_count = new_tasks.count or 0

    # 4. Thread 生成数
    new_threads = sb.table("chat_threads")\
        .select("id", count="exact")\
        .gte("created_at", start)\
        .lte("created_at", end)\
        .execute()
    new_thread_count = new_threads.count or 0

    # 5. 任务失败数（status = 'error'，昨日创建或更新的）
    failed_tasks = sb.table("tasks")\
        .select("id", count="exact")\
        .eq("status", "error")\
        .gte("updated_at", start)\
        .lte("updated_at", end)\
        .eq("is_demo", False)\
        .execute()
    failed_task_count = failed_tasks.count or 0

    # 6. 计算任务失败率
    fail_rate = (failed_task_count / new_task_count * 100) if new_task_count > 0 else 0.0

    return {
        "new_users":     new_user_count,
        "dau":           dau,
        "new_tasks":     new_task_count,
        "new_threads":   new_thread_count,
        "failed_tasks":  failed_task_count,
        "fail_rate":     fail_rate,
    }

def build_feishu_card(date_str: str, m: dict) -> dict:
    """构建飞书卡片消息"""
    fail_color = "red" if m["fail_rate"] > 5 else "green"
    return {
        "msg_type": "interactive",
        "card": {
            "schema": "2.0",
            "config": {"wide_screen_mode": True},
            "header": {
                "title": {
                    "tag": "plain_text",
                    "content": f"📊 AI-Video-Transcriber 日报 · {date_str}"
                },
                "template": "blue"
            },
            "body": {
                "elements": [
                    {
                        "tag": "column_set",
                        "flex_mode": "stretch",
                        "columns": [
                            _metric_col("👤 新注册用户", str(m["new_users"]), "人"),
                            _metric_col("🔥 DAU",       str(m["dau"]),       "人"),
                        ]
                    },
                    {
                        "tag": "column_set",
                        "flex_mode": "stretch",
                        "columns": [
                            _metric_col("🎬 Task 生成",   str(m["new_tasks"]),   "条"),
                            _metric_col("💬 Thread 生成", str(m["new_threads"]), "条"),
                        ]
                    },
                    {
                        "tag": "column_set",
                        "flex_mode": "stretch",
                        "columns": [
                            _metric_col("❌ 任务失败", str(m["failed_tasks"]), "条"),
                            _metric_col("📉 失败率",   f"{m['fail_rate']:.1f}", "%"),
                        ]
                    },
                    {
                        "tag": "hr"
                    },
                    {
                        "tag": "markdown",
                        "content": f"_自动生成 · 统计范围: {date_str} 00:00–23:59 CST_"
                    }
                ]
            }
        }
    }

def _metric_col(label: str, value: str, unit: str) -> dict:
    return {
        "tag": "column",
        "width": "weighted",
        "weight": 1,
        "elements": [
            {
                "tag": "markdown",
                "content": f"**{label}**\n<font color='green'>**{value}**</font> {unit}"
            }
        ]
    }

def send_to_feishu_webhook(webhook_url: str, payload: dict):
    resp = httpx.post(webhook_url, json=payload, timeout=10)
    resp.raise_for_status()
    result = resp.json()
    if result.get("code", 0) != 0:
        raise RuntimeError(f"飞书返回错误: {result}")
    print(f"✅ 日报已发送到 webhook: {result}", file=sys.stderr)

def format_report_text(date_str: str, m: dict) -> str:
    """输出适合 OpenClaw agent 直接发送的纯文本日报"""
    fail_indicator = "⚠️" if m["fail_rate"] > 5 else "✅"
    return (
        f"📊 **AI-Video-Transcriber 日报 · {date_str}**\n\n"
        f"👤 新注册用户：{m['new_users']} 人\n"
        f"🔥 DAU：{m['dau']} 人\n"
        f"🎬 Task 生成：{m['new_tasks']} 条\n"
        f"💬 Thread 生成：{m['new_threads']} 条\n"
        f"❌ 任务失败：{m['failed_tasks']} 条 {fail_indicator} 失败率 {m['fail_rate']:.1f}%\n\n"
        f"_统计范围: {date_str} 00:00–23:59 CST_"
    )

def main():
    start, end, date_str = get_yesterday_range()
    print(f"统计范围: {start} ~ {end}", file=sys.stderr)

    sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    metrics = fetch_metrics(sb, start, end)

    print(json.dumps({"date": date_str, "metrics": metrics}, ensure_ascii=False))

    # 如果设置了 webhook，额外推送一份卡片
    if FEISHU_WEBHOOK_URL:
        card = build_feishu_card(date_str, metrics)
        send_to_feishu_webhook(FEISHU_WEBHOOK_URL, card)
    else:
        # 输出纯文本供 OpenClaw agent 使用
        print(format_report_text(date_str, metrics), file=sys.stderr)

if __name__ == "__main__":
    main()

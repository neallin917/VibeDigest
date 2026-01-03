#!/usr/bin/env python3
"""
测试三层分类器
用法: python scripts/test_classifier.py [task_id]

如果提供 task_id，会从数据库获取 transcript
否则使用内置示例
"""
import asyncio
import sys
import json

# 确保父目录在 path 中
sys.path.insert(0, '.')

from summarizer import Summarizer
from db_client import DBClient

# 示例 transcripts 用于测试
SAMPLES = {
    "tutorial": """
    大家好，今天我们来学习 Python 装饰器。首先，什么是装饰器？
    装饰器本质上是一个函数，它接收一个函数作为参数，返回一个新的函数。
    让我们看第一个例子。定义一个简单的装饰器：
    def my_decorator(func):
        def wrapper():
            print("Before")
            func()
            print("After")
        return wrapper
    使用方法是在函数定义前加 @my_decorator。
    接下来我们看带参数的装饰器...
    """,
    
    "interview": """
    主持人：李总，您好！感谢您接受我们的采访。首先能介绍一下您对当前市场的看法吗？
    李总：谢谢。目前市场确实面临一些挑战，但我认为机会大于风险。
    主持人：具体来说呢？
    李总：首先从宏观环境看，政策支持力度在加大。其次，技术创新正在加速。
    我们看到 AI 领域的投资回报率非常可观，去年我们投的几个项目都已经盈利了。
    主持人：有没有什么风险需要注意的？
    李总：当然有。估值过高是最大的风险，另外是技术路线的不确定性。
    """,
    
    "finance": """
    今天我们来分析一下特斯拉的财报。Q3 季度营收 251 亿美元，同比增长 9%。
    毛利率下滑到 17.9%，主要原因是价格战的影响。
    关键数据：交付量 46.2 万辆，略低于预期的 47 万辆。
    现金流方面，经营现金流 33 亿美元，资本支出 23 亿美元。
    投资建议：短期内建议观望，等待 Q4 数据确认趋势。
    风险提示：竞争加剧、监管风险、Cybertruck 产能爬坡不及预期。
    """
}

async def test_with_sample(sample_name: str):
    """使用内置示例测试"""
    if sample_name not in SAMPLES:
        print(f"可用示例: {list(SAMPLES.keys())}")
        return
    
    transcript = SAMPLES[sample_name]
    summarizer = Summarizer()
    
    print(f"\n{'='*60}")
    print(f"测试示例: {sample_name}")
    print(f"{'='*60}")
    print(f"Transcript 片段: {transcript[:100].strip()}...")
    print(f"{'='*60}")
    
    result = await summarizer.classify_content(transcript)
    print(f"\n分类结果:")
    print(json.dumps(result, ensure_ascii=False, indent=2))

async def test_with_task(task_id: str):
    """从数据库获取 transcript 测试"""
    db = DBClient()
    
    # 获取 script 输出
    outputs = db.get_task_outputs(task_id)
    script_output = next((o for o in outputs if o['kind'] == 'script' and o.get('status') == 'completed'), None)
    
    if not script_output or not script_output.get('content'):
        print(f"未找到 task {task_id} 的已完成 script")
        return
    
    transcript = script_output['content']
    summarizer = Summarizer()
    
    print(f"\n{'='*60}")
    print(f"Task ID: {task_id}")
    print(f"Transcript 长度: {len(transcript)} 字符")
    print(f"{'='*60}")
    print(f"Transcript 片段: {transcript[:200].strip()}...")
    print(f"{'='*60}")
    
    result = await summarizer.classify_content(transcript)
    print(f"\n分类结果:")
    print(json.dumps(result, ensure_ascii=False, indent=2))

async def main():
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        # 检查是否是示例名称
        if arg in SAMPLES:
            await test_with_sample(arg)
        else:
            # 假设是 task_id
            await test_with_task(arg)
    else:
        # 默认测试所有示例
        for sample_name in SAMPLES:
            await test_with_sample(sample_name)
            print("\n")

if __name__ == "__main__":
    asyncio.run(main())

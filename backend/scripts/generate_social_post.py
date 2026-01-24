import asyncio
import json
import argparse
import sys
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent.parent))

from utils.env_loader import load_env  # noqa: E402
load_env()

from summarizer import Summarizer  # noqa: E402

SOCIAL_POST_PROMPT_SYSTEM = """你是一位顶尖的自媒体运营专家，擅长将长视频转录文稿改造成极具传播力的社交媒体精品推文（如微博、小红书）。

你的目标是：
1. **内容重塑**：从文稿中提取最有价值的内容，用极具网感、专业且通俗易懂的语言重写。
2. **纯净输出**：生成的文案必须是**直接面向最终读者的**。严禁在正文中出现“钩子”、“金句”、“干货”、“呼吁”等内部运营话术或标签。
3. **视觉排版**：使用优美的排版。包含清晰的小标题（可用 Emoji 加强）、适当的留白和分段，确保在长图中阅读体验极佳。
4. **制造共鸣**：标题要足够吸睛，正文要有启发性，结尾要有自然的互动引导。

请输出以下 JSON 格式：
{
  "title": "爆款标题（带 Emoji）",
  "content": "正式推文内容。要求：1. 禁显内部标签；2. 包含 3-4 个清晰的小标题；3. 金句要自然融入段落或独立成行，而非标注‘金句’二字；4. 逻辑严密，语气有力。"
}

风格要求：
- 语感像深度内容博主，既有态度又有深度
- 大量使用有力短句和金句（直接展示内容，不要标签）
- 严禁 AI 腔，确保文字有节奏感
"""

IMAGE_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/dist/markdown-it.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body {{
            font-family: 'Inter', 'Noto Sans SC', sans-serif;
            margin: 0;
            background-color: #0F0F0F;
            color: #F5F5F5;
        }}
        .bg-grid {{
            background-image:
                linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
            background-size: 40px 40px;
        }}
        .glass {{
            background: rgba(20, 20, 20, 0.6);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8);
        }}
        .glow {{
            position: absolute;
            width: 400px;
            height: 400px;
            background: radial-gradient(circle, rgba(62, 207, 142, 0.15) 0%, transparent 70%);
            border-radius: 50%;
            z-index: -1;
        }}
        .text-gradient-primary {{
            background: linear-gradient(to right, #3ECF8E, #34D399, #10B981);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}
        .content-text {{
            line-height: 1.8;
            letter-spacing: 0.01em;
        }}
        /* Markdown Styles */
        .markdown-body h2 {{
            font-size: 1.75rem;
            font-weight: 800;
            color: #FFFFFF;
            margin-top: 2.5rem;
            margin-bottom: 1.25rem;
            line-height: 1.3;
        }}
        .markdown-body p {{
            margin-bottom: 1.5rem;
        }}
        .markdown-body strong {{
            color: #3ECF8E;
            font-weight: 700;
        }}
        .markdown-body hr {{
            border: 0;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            margin: 2rem 0;
        }}
    </style>
</head>
<body class="p-12 flex flex-col items-center min-h-screen bg-grid relative overflow-hidden">
    <!-- Decorative Glows -->
    <div class="glow -top-20 -left-20"></div>
    <div class="glow bottom-40 -right-20" style="background: radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%);"></div>

    <div id="capture-area" class="w-[640px] glass rounded-[2.5rem] p-12 relative flex flex-col">
        <!-- Brand Header -->
        <div class="flex items-center space-x-3 mb-10">
            <div class="p-2 bg-white/5 rounded-xl border border-white/10 shadow-inner">
                <img src="{logo_path}" class="w-8 h-8 rounded-lg">
            </div>
            <span class="text-[#F5F5F5] font-bold text-xl tracking-tight">Vibedigest.neallin.xyz</span>
        </div>

        <!-- Title -->
        <h1 class="text-4xl font-extrabold text-white leading-[1.3] mb-10 tracking-tight">
            {title}
        </h1>

        <!-- Content (Rendered via JS) -->
        <div id="content" class="markdown-body content-text text-[#E5E5E5]/90 text-[1.25rem] whitespace-pre-wrap"></div>
        <script id="raw-content" type="text/plain">{content}</script>

        <script>
            const md = window.markdownit({{
                html: true,
                linkify: true,
                typographer: true
            }});
            const raw = document.getElementById('raw-content').textContent;
            document.getElementById('content').innerHTML = md.render(raw);
        </script>

        <!-- Footer -->
        <div class="mt-16 pt-10 border-t border-white/5 flex justify-between items-end">
            <div class="flex flex-col space-y-1">
                <span class="text-white/30 text-xs uppercase tracking-widest font-medium">Powered by AI Video Summarizer</span>
                <span class="text-[#3ECF8E] font-bold text-xl tracking-wide">Vibedigest.neallin.xyz</span>
            </div>
            <div class="flex flex-col items-end space-y-3">
                <div class="px-5 py-2 bg-[#3ECF8E]/10 rounded-full border border-[#3ECF8E]/20">
                    <span class="text-[#3ECF8E] font-bold text-sm tracking-wide">扫码查看原文</span>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
"""

class SocialPostGenerator:
    def __init__(self):
        self.summarizer = Summarizer()
        self.output_dir = Path(__file__).parent.parent / "generations"
        self.output_dir.mkdir(exist_ok=True)

    async def generate_content(self, transcript: str):
        print("🚀 Calling LLM to generate social media content...")
        messages = [
            {"role": "system", "content": SOCIAL_POST_PROMPT_SYSTEM},
            {"role": "user", "content": f"请基于以下转录稿，写一段适合传播的社交媒体文稿：\n\n{transcript}"}
        ]
        
        # Priority for gpt-5.2 as requested
        models = ["gpt-5.2", "gpt-4o", "gpt-4o-mini"]
        
        response = await self.summarizer._ainvoke_with_fallback(
            models=models,
            messages=messages,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.content)

    async def generate_image(self, data: dict):
        from playwright.async_api import async_playwright
        
        print("📸 Rendering image with Playwright...")
        
        # Resolve logo path (absolute path for playwright access)
        logo_path = Path(__file__).parent.parent.parent / "frontend" / "src" / "app" / "icon.png"
        if not logo_path.exists():
             logo_path = Path(__file__).parent.parent.parent / "frontend" / "public" / "icon.png"
        
        logo_uri = logo_path.absolute().as_uri()
        
        # Prepare HTML
        html_content = IMAGE_TEMPLATE.format(
            logo_path=logo_uri,
            title=data['title'],
            content=data['content']
        )
        
        html_file = self.output_dir / "temp_post.html"
        html_file.write_text(html_content, encoding="utf-8")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            # Use file URI to load local logo correctly
            await page.goto(html_file.absolute().as_uri())
            
            # Wait for content to render and fonts to load
            await page.wait_for_load_state("networkidle")
            
            # Dynamic height screenshot
            area = await page.query_selector("#capture-area")
            output_path = self.output_dir / f"social_post_{int(asyncio.get_event_loop().time())}.png"
            
            await area.screenshot(path=str(output_path))
            await browser.close()
            
            print(f"✅ Image saved to: {output_path}")
            return output_path

async def main():
    parser = argparse.ArgumentParser(description="Generate social media posts from transcripts.")
    parser.add_argument("--input", type=str, help="Path to transcript file")
    parser.add_argument("--text", type=str, help="Literal transcript text")
    
    args = parser.parse_args()
    
    transcript = ""
    if args.text:
        transcript = args.text
    elif args.input:
        transcript = Path(args.input).read_text(encoding="utf-8")
    else:
        # Read from stdin if no args
        print("📝 Enter/Paste transcript (Ctrl-D to finish):")
        transcript = sys.stdin.read()

    if not transcript.strip():
        print("❌ No transcript provided.")
        return

    gen = SocialPostGenerator()
    data = await gen.generate_content(transcript)
    
    print("\n" + "="*50)
    print(f"TITLE: {data['title']}")
    print("-" * 50)
    print(data['content'])
    print("="*50 + "\n")
    
    img_path = await gen.generate_image(data)
    print(f"DONE! View your post image at: {img_path}")

if __name__ == "__main__":
    asyncio.run(main())

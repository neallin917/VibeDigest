import json
from pathlib import Path

fixtures_dir = Path('backend/tests/fixtures/transcripts')
# Sort by modification time to get newest first
json_files = sorted(fixtures_dir.glob('*.json'), key=lambda x: x.stat().st_mtime, reverse=True)

output_path = Path('backend/tests/fixtures/FIXTURES_INDEX.md')

def format_duration(seconds):
    if seconds is None or seconds == 0:
        return 'N/A'
    try:
        s = int(float(seconds))
        return f'{s // 60}:{s % 60:02d}'
    except:
        return 'N/A'

lines = [
    '# VibeDigest Transcript Fixtures Index',
    '',
    'This file provides an index of all real transcripts collected from Supabase for local development and benchmarking.',
    '',
    '| Task ID | Title | Duration | Source |',
    '| --- | --- | --- | --- |'
]

for jf in json_files:
    try:
        with open(jf, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Use task_id from JSON or filename as fallback
            task_id = data.get('task_id') or jf.stem
            title = data.get('title', 'Untitled').replace('|', '\\|')
            duration = format_duration(data.get('duration'))
            url = data.get('url', 'N/A')
            
            lines.append(f'| `{task_id}` | {title} | {duration} | [Link]({url}) |')
    except Exception as e:
        print(f"Error processing {jf}: {e}")
        continue

with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f'Successfully created index with {len(lines) - 6} entries at {output_path}')

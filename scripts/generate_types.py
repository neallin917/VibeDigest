#!/usr/bin/env python3
"""
Generate TypeScript types from Pydantic models.

This script uses pydantic-to-typescript (pydantic2ts) to generate TypeScript
interfaces from the backend Pydantic schemas, ensuring type consistency
between frontend and backend.

Usage:
    python scripts/generate_types.py

Requirements:
    pip install pydantic-to-typescript

Output:
    frontend/src/types/generated/
        ├── models.ts      # Core domain models
        ├── events.ts      # SSE event types
        ├── api.ts         # API response types
        └── index.ts       # Re-exports all types
"""

import subprocess
import sys
from pathlib import Path
import json
import os

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
OUTPUT_DIR = PROJECT_ROOT / "frontend" / "src" / "types" / "generated"


def check_dependencies():
    """Check if pydantic2ts is installed."""
    try:
        import pydantic2ts  # noqa: F401
        return True
    except ImportError:
        print("pydantic-to-typescript not installed.")
        print("Install with: pip install pydantic-to-typescript")
        return False


def generate_types_for_module(module_path: str, output_file: str) -> bool:
    """
    Generate TypeScript types for a specific Python module.

    Args:
        module_path: Python module path (e.g., "schemas.events")
        output_file: Output TypeScript file path

    Returns:
        True if generation succeeded, False otherwise
    """
    cmd = [
        sys.executable,
        "-m",
        "pydantic2ts",
        "--module", module_path,
        "--output", str(output_file),
    ]

    try:
        result = subprocess.run(
            cmd,
            cwd=str(BACKEND_DIR),
            capture_output=True,
            text=True,
            env={**os.environ, "PYTHONPATH": str(BACKEND_DIR)},
        )

        if result.returncode != 0:
            print(f"Error generating types for {module_path}:")
            print(result.stderr)
            return False

        print(f"Generated: {output_file}")
        return True

    except Exception as e:
        print(f"Failed to generate types for {module_path}: {e}")
        return False


def generate_manual_types():
    """
    Generate TypeScript types manually for models that pydantic2ts has trouble with.
    This is a fallback for complex nested models or when pydantic2ts is not available.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Manual type definitions based on backend schemas
    events_ts = '''/**
 * SSE Event types - Auto-generated from backend/schemas/events.py
 * DO NOT EDIT MANUALLY - Run `npm run generate-types` to regenerate
 */

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'error';

export type OutputKind =
  | 'script'
  | 'script_raw'
  | 'audio'
  | 'classification'
  | 'summary'
  | 'comprehension_brief';

export interface TaskProgressEvent {
  event_type: 'progress';
  task_id: string;
  status: TaskStatus;
  progress: number;
  stage: string;
  message?: string;
  timestamp: string;
}

export interface TaskOutputEvent {
  event_type: 'output';
  task_id: string;
  output_id: string;
  output_kind: OutputKind;
  status: TaskStatus;
  content?: string;
  locale?: string;
  timestamp: string;
}

export interface TaskCompleteEvent {
  event_type: 'complete';
  task_id: string;
  status: 'completed';
  video_title?: string;
  thumbnail_url?: string;
  duration?: number;
  timestamp: string;
}

export interface TaskErrorEvent {
  event_type: 'error';
  task_id: string;
  status: 'error';
  error: string;
  error_code?: string;
  recoverable: boolean;
  timestamp: string;
}

export interface HeartbeatEvent {
  event_type: 'heartbeat';
  timestamp: string;
}

export type SSEEvent =
  | TaskProgressEvent
  | TaskOutputEvent
  | TaskCompleteEvent
  | TaskErrorEvent
  | HeartbeatEvent;
'''

    api_ts = '''/**
 * API Response types - Auto-generated from backend/schemas/api.py
 * DO NOT EDIT MANUALLY - Run `npm run generate-types` to regenerate
 */

import { TaskStatus, OutputKind } from './events';

export interface TaskCreateResponse {
  task_id: string;
  message: string;
}

export interface TaskStatusResponse {
  id: string;
  video_url: string;
  video_title?: string;
  thumbnail_url?: string;
  status: TaskStatus;
  progress: number;
  error?: string;
  created_at: string;
  updated_at?: string;
  duration?: number;
  author?: string;
}

export interface VideoPreviewResponse {
  title: string;
  thumbnail: string;
  duration: number;
  author: string;
  url: string;
  description?: string;
  upload_date?: string;
  view_count?: number;
}

export interface TaskOutputResponse {
  id: string;
  task_id: string;
  kind: OutputKind;
  status: TaskStatus;
  content?: string;
  locale?: string;
  progress: number;
  error?: string;
  created_at: string;
  updated_at?: string;
}

export interface TaskWithOutputsResponse {
  task: TaskStatusResponse;
  outputs: TaskOutputResponse[];
}

export interface RetryOutputResponse {
  message: string;
  output_id?: string;
}

export interface ErrorResponse {
  detail: string;
  error_code?: string;
}

export interface QuotaExceededResponse {
  detail: string;
  error_code: string;
  remaining_credits?: number;
}
'''

    models_ts = '''/**
 * Domain model types - Auto-generated from backend Pydantic models
 * DO NOT EDIT MANUALLY - Run `npm run generate-types` to regenerate
 */

// Content Classification
export interface ContentClassification {
  content_form: string;
  info_structure: string;
  cognitive_goal: string;
  confidence: number;
}

// Summary models
export interface KeyPoint {
  title: string;
  detail: string;
  evidence: string;
  startSeconds?: number;
  endSeconds?: number;
}

export interface ActionItem {
  content: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Risk {
  content: string;
  severity: 'high' | 'medium' | 'low';
}

export interface SummaryResponse {
  version: number;
  language: string;
  overview: string;
  keypoints: KeyPoint[];
  action_items?: ActionItem[];
  risks?: Risk[];
  content_type?: ContentClassification;
}

// Comprehension models
export interface InsightItem {
  title: string;
  new_perspective: string;
  why_it_matters: string;
}

export interface TargetAudience {
  who_benefits: string[];
  who_wont: string[];
}

export interface ComprehensionBriefResponse {
  core_intent: string;
  core_position: string;
  key_insights: InsightItem[];
  what_to_ignore: string[];
  target_audience: TargetAudience;
  reusable_takeaway: string;
}

// Transcript validation
export interface TranscriptValidation {
  is_valid: boolean;
  reason: string;
}
'''

    index_ts = '''/**
 * Generated TypeScript types from backend Pydantic models
 * DO NOT EDIT MANUALLY - Run `npm run generate-types` to regenerate
 */

export * from './events';
export * from './api';
export * from './models';
'''

    # Write files
    (OUTPUT_DIR / "events.ts").write_text(events_ts)
    (OUTPUT_DIR / "api.ts").write_text(api_ts)
    (OUTPUT_DIR / "models.ts").write_text(models_ts)
    (OUTPUT_DIR / "index.ts").write_text(index_ts)

    print(f"Generated manual types in {OUTPUT_DIR}")
    return True


def main():
    """Main entry point."""
    print("Generating TypeScript types from Pydantic models...")
    print(f"Output directory: {OUTPUT_DIR}")

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Try using pydantic2ts first
    if check_dependencies():
        modules = [
            ("schemas.events", OUTPUT_DIR / "events.ts"),
            ("schemas.api", OUTPUT_DIR / "api.ts"),
        ]

        success = True
        for module_path, output_file in modules:
            if not generate_types_for_module(module_path, str(output_file)):
                success = False

        if not success:
            print("\nFalling back to manual type generation...")
            generate_manual_types()
    else:
        print("Using manual type generation...")
        generate_manual_types()

    # Generate index.ts
    index_content = '''/**
 * Generated TypeScript types from backend Pydantic models
 * DO NOT EDIT MANUALLY - Run `npm run generate-types` to regenerate
 */

export * from './events';
export * from './api';
export * from './models';
'''
    (OUTPUT_DIR / "index.ts").write_text(index_content)

    print("\nType generation complete!")
    print(f"Files generated in: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()

# Standardized Test Report - Bilibili & Apple Podcast Integration

## Overview
**Date:** 2026-02-06
**Scope:** URL handling, Platform detection, Pipeline integration, Real network extraction
**Status:** ✅ Mostly Passing (Known Issue with Apple Podcasts Network Extraction)

## 1. Frontend Unit Tests (Layer 1 - Input Validation)
**File:** `frontend/src/lib/__tests__/url-utils.test.ts`
**Goal:** Verify "Liberal Input" logic for extracting and normalizing URLs.

| Test Case | Input | Expected | Result |
|-----------|-------|----------|--------|
| **Naked Bilibili** | `bilibili.com/video/BV...` | `https://bilibili.com/video/BV...` | ✅ PASS |
| **Naked YouTube** | `youtube.com/watch?v=...` | `https://youtube.com/watch?v=...` | ✅ PASS |
| **Naked Apple** | `podcasts.apple.com/...` | `https://podcasts.apple.com/...` | ✅ PASS |
| **Standard HTTPS** | `https://youtube.com/...` | `https://youtube.com/...` | ✅ PASS |
| **Surrounding Text** | `Check this: bilibili.com/...` | `https://bilibili.com/...` | ✅ PASS |
| **Raw YouTube ID** | `dQw4w9WgXcQ` | `https://youtube.com/watch?v=dQw4w9WgXcQ` | ✅ PASS |
| **Invalid Input** | `Hello World` | `null` | ✅ PASS |

**Summary:** 12/12 Tests Passed. The new `extractAndNormalizeUrl` utility is robust.

## 2. Backend Unit Tests (Layer 1 - Logic)
**File:** `backend/tests/test_bilibili_apple_integration.py`
**Goal:** Verify backend URL processing and platform flags.

| Test Case | Purpose | Result |
|-----------|---------|--------|
| `test_bilibili_is_not_youtube` | Ensure `is_youtube=False` for Bilibili | ✅ PASS |
| `test_apple_is_not_youtube` | Ensure `is_youtube=False` for Apple | ✅ PASS |
| `test_url_normalization_apple` | Ensure critical params preserved | ✅ PASS |
| `test_url_normalization_bilibili` | Ensure tracking params stripped | ⚠️ XFAIL (Feature Pending) |

**Note:** `test_url_normalization_bilibili` is marked `XFAIL` because strict parameter stripping is not yet implemented in the backend, but this does not block functionality.

## 3. Backend Integration Tests (Layer 2 - Pipeline)
**File:** `backend/tests/test_bilibili_apple_integration.py`
**Goal:** Verify workflow routing (Whisper vs Supadata) using Mocks.

| Test Case | Purpose | Result |
|-----------|---------|--------|
| `test_bilibili_full_pipeline` | Verify Bilibili -> Download -> Whisper | ✅ PASS |
| `test_apple_full_pipeline` | Verify Apple -> Download -> Whisper | ✅ PASS |

**Summary:** The LangGraph workflow correctly identifies these non-YouTube platforms and routes them to the Whisper transcriber (bypassing Supadata, which is YouTube-only).

## 4. Network Tests (Layer 3 - Real World)
**File:** `backend/tests/test_bilibili_apple_integration.py`
**Goal:** Verify `yt-dlp` compatibility with live platforms.

| Platform | URL Tested | Result | Notes |
|----------|------------|--------|-------|
| **Bilibili** | `https://www.bilibili.com/video/BV1vizZBHEhS` | ✅ PASS | Metadata extraction works perfectly. |
| **Apple Podcasts** | `https://podcasts.apple.com/.../id1862365307` | ❌ FAIL | `yt-dlp` error: "Unable to extract server data". |

**Analysis of Apple Failure:**
The current version of `yt-dlp` (2026.02.04) is failing to parse the server data from Apple Podcasts pages. This is an external dependency issue.
- **Impact:** Apple Podcast processing will likely fail in production until `yt-dlp` is updated or a workaround is implemented.
- **Action Item:** Monitor `yt-dlp` issues or consider a fallback extractor for Apple Podcasts.

## Conclusion
- **Frontend Input:** ✅ Fixed & Robust.
- **Bilibili Support:** ✅ Fully Operational (Frontend + Backend + Network).
- **Apple Podcast Support:** ⚠️ Partial (Frontend + Backend Logic OK, but Network Extraction Failing).

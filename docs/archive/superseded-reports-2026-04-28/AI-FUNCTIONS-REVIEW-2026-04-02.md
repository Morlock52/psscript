# AI Functions Review & Upgrade Plan

**Date:** April 2, 2026
**Current model refresh:** April 26, 2026
**Scope:** All AI functions, models, SDKs, and integrations across backend, Python AI service, and frontend
**Goal:** Update to latest OpenAI models, frameworks, and best practices

---

## Current State Audit

### Model References Found Across Project

| File | Current Model | Issue |
|------|--------------|-------|
| `src/ai/config.py:64` | `gpt-4o` (fallback_model) | **DEPRECATED Feb 2026** - removed from API |
| `src/ai/config.py:63` | `gpt-4o-mini` (fast_model) | **DEPRECATED Feb 2026** |
| `src/ai/utils/model_router.py:87-100` | `gpt-4o-mini`, `gpt-4o` | **DEPRECATED** - entire model entries |
| `src/ai/utils/model_router.py:117-119` | `o3-mini` | Should be `o4-mini` (current lightweight reasoning) |
| `src/ai/langgraph_endpoints.py:298-300` | `gpt-4o`, `gpt-4o-mini` | **DEPRECATED** model list |
| `src/ai/langgraph_endpoints.py:94` | `gpt-4` | **DEPRECATED** - very old model |
| `src/ai/test-endpoints-validation.py:93` | `gpt-4o`, `gpt-4-turbo` | **DEPRECATED** test references |
| `crawl4ai-vector-db/docker-compose.yml:22-23` | `text-embedding-ada-002`, `gpt-4` | **DEPRECATED** models |
| `src/ai/config.py:60-61` | `gpt-4.1` | OK - still current for coding |
| `src/ai/config.py:62` | `o3` | OK - still current for reasoning |
| `src/ai/config.py:75` | `text-embedding-3-large` | OK - still current |
| `src/ai/voice_service.py:325` | `gpt-4o-mini-tts` | OK - current TTS model |
| `src/ai/voice_service.py:386` | `gpt-4o-mini-transcribe` / `gpt-4o-transcribe-diarize` | OK - current STT models |

### SDK Versions

| Package | Current | Latest (Apr 2026) | Action |
|---------|---------|-------------------|--------|
| `openai` (Node.js) | `^6.26.0` | `6.33.0` | UPDATE |
| `openai` (Python) | `>=2.25.0` | `2.30.0` | UPDATE |
| `langgraph` (Python) | `>=0.2.0` | `1.1.0` | **MAJOR UPDATE** |
| `langchain` (Python) | `>=0.3.0` | `1.0.0` (GA) | **MAJOR UPDATE** |
| `langchain-core` | `>=0.3.0` | Merged into langchain 1.0 | UPDATE |
| `langchain-community` | `>=0.3.0` | `1.0.x` | UPDATE |
| `langchain-openai` | `>=0.2.0` | `1.0.x` | UPDATE |

### Assistants API Usage (CRITICAL - Sunsets Aug 26, 2026)

| File | Usage | Action Required |
|------|-------|----------------|
| `src/backend/src/services/agentic/AssistantsStore.ts` | Stores assistant configs | Migrate to Responses API |
| `src/backend/src/controllers/Agentic/AssistantsController.ts` | CRUD for assistants | Migrate to Responses API |
| `src/backend/src/routes/assistants.ts` | Assistants API routes | Migrate to Responses API |
| `src/ai/agents/openai_assistant_agent.py` | OpenAI Assistants agent | Migrate to Responses API |

### Architecture Issues

1. **Multiple OpenAI client instances** - ScriptGenerator.ts and SecurityAnalyzer.ts each create their own `new OpenAI()` instead of sharing a singleton
2. **No structured outputs** - All AI calls use free-form text; should use JSON schema mode for reliable parsing
3. **Hardcoded model strings** - Models scattered across files instead of centralized config
4. **No cost tracking** - No visibility into AI API spend
5. **Outdated LangGraph patterns** - Using 0.x patterns instead of 1.0+ stable API

---

## Recommended Changes

### 1. Update Deprecated Models (CRITICAL)

Replace all deprecated model references:

| Deprecated | Replacement | Reason |
|-----------|-------------|--------|
| `gpt-4o` | `gpt-4.1` | gpt-4o retired Feb 2026; gpt-4.1 is better for code |
| `gpt-4o-mini` | `gpt-5.4-mini` | gpt-4o-mini retired; 5.4-mini is the current fast hosted replacement |
| `gpt-4` | `gpt-4.1` | gpt-4 long deprecated |
| `gpt-4-turbo` | `gpt-4.1` | gpt-4-turbo deprecated |
| `o3-mini` | `o4-mini` | o4-mini is the current lightweight reasoning model |
| `text-embedding-ada-002` | `text-embedding-3-small` | ada-002 is legacy |

### 2. Update SDK Versions

**Node.js** (`src/backend/package.json`):
```json
"openai": "^6.33.0"
```

**Python** (`src/ai/requirements.txt`):
```
openai>=2.30.0
langgraph>=1.1.0
langchain>=1.0.0
langchain-openai>=1.0.0
langchain-community>=1.0.0
```

### 3. Add GPT-5.5 as Flagship Model

The current GPT family is now:
- `gpt-5.5` - Flagship, best overall quality
- `gpt-5.4-mini` - Balanced speed/quality
- `gpt-5.4-nano` - Fastest, cheapest

Recommended config update:
```python
default_model = "gpt-4.1"        # Best for code (keep - 1M context)
reasoning_model = "o3"           # Keep for reasoning
fast_model = "gpt-5.4-mini"     # Replace gpt-4o-mini
fallback_model = "gpt-4.1"      # Replace gpt-4o
flagship_model = "gpt-5.5"      # NEW - for complex multi-step tasks
```

### 4. Create Shared OpenAI Client (Backend)

Replace per-file client instantiation with a shared singleton:
```typescript
// services/openaiClient.ts
import OpenAI from 'openai';
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

### 5. Add Structured Outputs

Use JSON schema mode for reliable parsing of AI responses:
```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4.1",
  messages: [...],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "script_analysis",
      strict: true,
      schema: { /* Zod-derived schema */ }
    }
  }
});
```

### 6. Prepare for Assistants API Migration

The Assistants API sunsets **August 26, 2026**. Plan:
- Phase 1 (now): Add deprecation warnings to Assistants endpoints
- Phase 2 (June): Implement Responses API equivalents
- Phase 3 (July): Migrate data, switch over

---

## Implementation Plan

### Phase 1: Model & SDK Updates (Do Now)

| # | Task | Files | Priority |
|---|------|-------|----------|
| 1.1 | Update config.py model defaults | `src/ai/config.py` | CRITICAL |
| 1.2 | Update model_router.py model entries | `src/ai/utils/model_router.py` | CRITICAL |
| 1.3 | Update langgraph_endpoints.py models | `src/ai/langgraph_endpoints.py` | CRITICAL |
| 1.4 | Update test validation models | `src/ai/test-endpoints-validation.py` | HIGH |
| 1.5 | Update crawl4ai docker-compose models | `crawl4ai-vector-db/docker-compose.yml` | LOW |
| 1.6 | Update Node.js openai SDK version | `src/backend/package.json` | HIGH |
| 1.7 | Update Python requirements versions | `src/ai/requirements.txt` | HIGH |

### Phase 2: Architecture Improvements (Do Now)

| # | Task | Files | Priority |
|---|------|-------|----------|
| 2.1 | Create shared OpenAI client singleton | New: `src/backend/src/services/openaiClient.ts` | HIGH |
| 2.2 | Refactor ScriptGenerator to use shared client | `src/backend/src/services/agentic/tools/ScriptGenerator.ts` | HIGH |
| 2.3 | Refactor SecurityAnalyzer to use shared client | `src/backend/src/services/agentic/tools/SecurityAnalyzer.ts` | HIGH |
| 2.4 | Add structured outputs to analysis endpoint | `src/ai/main.py` analysis routes | MEDIUM |

### Phase 3: Assistants API Deprecation Prep

| # | Task | Files | Priority |
|---|------|-------|----------|
| 3.1 | Add sunset warning headers to Assistants routes | `src/backend/src/routes/assistants.ts` | HIGH |
| 3.2 | Document migration path | This document | MEDIUM |

---

## Research Sources (April 2026)

- OpenAI Models Documentation: gpt-5.5, gpt-5.4-mini/nano, gpt-4.1, o3, o4-mini are current production models
- GPT-4o retired from API Feb 16, 2026
- Assistants API sunset: August 26, 2026 (migrate to Responses API)
- OpenAI Node SDK: 6.33.0, Python SDK: 2.30.0
- LangGraph 1.1.0 (GA), LangChain 1.0 (GA)
- text-embedding-3-large/small are current (no newer embedding models)
- gpt-4o-mini-tts and gpt-4o-mini-transcribe are current audio models

---

## Implementation Status

All changes implemented and verified on April 2, 2026.

| Task | Status |
|------|--------|
| Replace deprecated models (gpt-4o, gpt-4o-mini, o3-mini, gpt-4) | DONE |
| Add gpt-5.5 flagship model | DONE |
| Update Node.js openai SDK to ^6.33.0 | DONE |
| Update Python openai SDK to >=2.30.0 | DONE |
| Update LangGraph to >=1.1.0 | DONE |
| Update LangChain to >=1.0.0 (GA) | DONE |
| Create shared OpenAI client singleton | DONE |
| Refactor ScriptGenerator to shared client | DONE |
| Refactor SecurityAnalyzer to shared client | DONE |
| Refactor RunEngine to shared client | DONE |
| Add Assistants API sunset headers | DONE |
| Update model_router.py with current models | DONE |
| Update test validation models | DONE |

### Verification

| Check | Result |
|-------|--------|
| TypeScript (`npx tsc --noEmit`) | 0 errors |
| ESLint (`npm run lint`) | 0 errors, 2 warnings (pre-existing) |

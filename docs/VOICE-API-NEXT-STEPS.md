# Voice API Next Steps

This roadmap replaces the original pre-implementation plan and reflects current state as of February 14, 2026.

## Completed Foundation

- Voice feature is implemented in frontend, backend, and AI service.
- OpenAI is the active provider path for TTS/STT.
- Tests 1-8 exist and are automated.
- CI includes a gated voice integration job (requires `OPENAI_API_KEY` secret).

## Phase 1: Reliability (Immediate)

1. Add deterministic fixture tests for recognition edge cases:
   - silence
   - clipped speech
   - mixed-language phrase
2. Add rate-limit coverage and abuse-path tests for voice endpoints.
3. Add dashboard alerts for voice error-rate spikes by endpoint.

## Phase 2: Performance (Near-term)

1. Add percentile and error SLOs for:
   - `/api/voice/synthesize`
   - `/api/voice/recognize`
2. Track cache hit-rate by route and key-scope.
3. Benchmark container-level concurrency with representative production audio payloads.

## Phase 3: Product UX (Near-term)

1. Add inline user feedback states for:
   - unsupported audio format
   - payload size exceeded
   - invalid API key override
2. Add voice preset profiles in settings for common use cases.
3. Add transcript confidence display when available.

## Phase 4: Governance and Ops

1. Keep `docs/VOICE-TESTS-1-8-LATEST.md` updated from release-candidate runs.
2. Add release checklist gate requiring a passing `test:voice:1-8:report` artifact.
3. Keep support runbook in `docs/SUPPORT.md` synchronized with endpoint behavior.

## Out of Scope (for now)

- Reintroducing multi-provider fallback logic.
- Supporting STT for raw `pcm`/`opus` in current backend contract.

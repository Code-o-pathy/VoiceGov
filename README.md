# VoiceGov

**A voice-first interaction layer for complex Indian public-service portals.**

VoiceGov lets a citizen *speak* what they want instead of figuring out how a
complicated government website works. It sits on top of a **high-fidelity
replica** of the Income Tax e-Filing portal, understands natural-language
requests in **English / Hindi / Hinglish**, and then **navigates, fills, and
submits** the workflow on the replica — making every action visible and safe.

> Built for the *Build What Moves India* hackathon. The replica uses synthetic
> data and a mock backend. **No real government system is ever contacted.**

---

## Demo narrative

Say (or type): **“Mujhe apna income tax refund status check karna hai.”**

VoiceGov will:

1. Transcribe your speech and show the transcript.
2. Detect the intent (`check_refund_status`) and language.
3. Find the matching semantic workflow.
4. Navigate the replica: **Home → Services → Know Your Refund Status**.
5. Ask you for your **PAN** (missing-information handling).
6. Fill the PAN, select the Assessment Year.
7. Ask you to **confirm** before submitting (confirmation gate).
8. Submit the simulated request and display + read out the result.

Every step appears in the **Action Timeline**, and the exact element being
operated on is **highlighted** on the replica.

---

## Architecture — *semantic reasoning, deterministic execution*

```
 Mic ─▶ Speech-to-Text ─▶ Intent Parser ─▶ Workflow Registry + Observer
                                                     │
                                                     ▼
                                              LLM Planner (Gemini)
                                                     │  structured actions (JSON)
                                                     ▼
                                              Action Validator
                                                     │
                                                     ▼
                                              DOM Executor  ─▶  Replica
                                                     │
                                                     └────▶ Observe new state ─▶ Planner
```

The core principle: **the LLM decides _what_ semantic action to take; it never
decides _how_ the DOM is manipulated.**

- The LLM only ever emits **semantic element ids** (`pan_input`,
  `refund_status_link`, …) and a fixed **action vocabulary**
  (`navigate | click | fill | select | scroll | read | highlight |
  request_user_input`).
- It **cannot** emit JavaScript, CSS selectors, or URLs.
- Every action is **validated** against the workflow/state before running.
- Selectors live only in the application-owned **executor**
  (`element_id → #dom-id`).

If the LLM output fails schema validation, VoiceGov falls back to the
deterministic planner rather than executing guessed behaviour.

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                # mounts the VoiceGov app
│   └── api/
│       ├── intent/route.ts     # intent extraction (Gemini + mock fallback)
│       └── plan/route.ts       # semantic planning (Gemini + mock fallback)
├── components/
│   ├── replica/                # high-fidelity Income Tax portal replica
│   └── voicegov/               # voice control, transcript, timeline, dialog
├── lib/
│   ├── stt/useSpeech.ts        # Web Speech API hook
│   ├── intent/mockIntent.ts    # deterministic intent parser
│   ├── planner/                # Gemini client, prompts, deterministic planner
│   ├── validator/              # action validator
│   ├── executor/               # deterministic DOM executor (owns selectors)
│   ├── observer/               # compact semantic state observation
│   ├── replica/                # replica store + mock backend
│   ├── session/                # synthetic user session (value_ref resolution)
│   └── voicegov/useVoiceGov.ts # observe → plan → validate → execute loop
├── workflows/                  # semantic workflow registry
└── schemas/                    # action / workflow / planner types + zod
```

---

## Getting started

```bash
npm install
npm run dev
# open http://localhost:3000 in Chrome (Web Speech API works best in Chrome)
```

### Optional: enable the Gemini planner

The demo runs **fully offline** using a deterministic mock planner. To enable
the Gemini-powered LLM planner and intent parser:

```bash
cp .env.local.example .env.local
# add your key:
# GEMINI_API_KEY=your_key_here
```

The `planner:` badge in the UI shows whether a step came from `gemini` or the
`mock` fallback.

---

## Safety & scope (by design)

- ✅ Structured, application-constrained actions only — no arbitrary code.
- ✅ Invalid actions are blocked by the validator.
- ✅ Missing info is requested; consequential actions require confirmation.
- ✅ At least one recoverable failure path (invalid PAN → re-prompt).
- ✅ Synthetic data; PANs are masked in state/logs; nothing is sent to any real
  government backend.
- 🚫 No Chrome extension, cross-origin automation, CAPTCHA/OTP bypass, or real
  payments.

---

## Try these commands

- `Mujhe apna income tax refund status check karna hai`
- `Check my income tax refund status`
- `मुझे रिफंड स्टेटस देखना है`
- When asked for PAN, try **`ABCDE1234F`** (refund issued),
  **`AAAPZ9012K`** (under process), or any other valid-format PAN
  (no records — recoverable), or an invalid PAN like `ABC` (validation error).

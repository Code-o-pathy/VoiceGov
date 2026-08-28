"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, PlannerOutput } from "@/schemas/actions";
import type { Intent, PlannerInput, Observation } from "@/schemas/planner";
import type { Workflow } from "@/schemas/workflow";
import { observe } from "@/lib/observer/observer";
import { validateAction } from "@/lib/validator/validator";
import { Executor } from "@/lib/executor/executor";
import { getWorkflowForIntent } from "@/workflows/registry";
import { sessionStore } from "@/lib/session/store";
import { parseIntentLocal, extractEntities } from "@/lib/intent/mockIntent";
import { planLocal } from "@/lib/planner/mockPlanner";
import { interpretLocal } from "@/lib/interpreter/mockInterpret";
import { replicaStore } from "@/lib/replica/store";
import {
  PAN_REGEX,
  AADHAAR_REGEX,
  maskPan,
  maskAadhaar,
  type ServiceResult,
} from "@/lib/replica/mockApi";
import type { StoreField } from "@/schemas/workflow";
import type { InterpretInput, InterpretOutput } from "@/schemas/interpret";

export type StepStatus = "active" | "done" | "error";
export interface TimelineItem {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

export type Pending =
  | { kind: "input"; field: string; prompt: string }
  | { kind: "confirmation"; summary: string };

export interface VoiceGovState {
  transcript: string;
  intent: Intent | null;
  timeline: TimelineItem[];
  status: string;
  pending: Pending | null;
  running: boolean;
  speaking: boolean;
  result: ServiceResult | null;
  plannerSource: string;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function useVoiceGov() {
  const [transcript, setTranscript] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [status, setStatus] = useState(
    "Ready. Tap the mic and tell VoiceGov what you need."
  );
  const [pending, setPending] = useState<Pending | null>(null);
  const [running, setRunning] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [result, setResult] = useState<ServiceResult | null>(null);
  const [plannerSource, setPlannerSource] = useState("");

  const workflowRef = useRef<Workflow | null>(null);
  const executorRef = useRef<Executor | null>(null);
  const intentRef = useRef<Intent | null>(null);
  const entitiesRef = useRef<Record<string, string>>({});
  const confirmRef = useRef(false);
  const drivingRef = useRef(false);
  // Accumulates spoken fragments while answering a PAN/Aadhaar prompt so we
  // don't act on a partial value like "ABCDE".
  const answerBufferRef = useRef("");
  const pendingRef = useRef<Pending | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Function refs to sidestep declaration-order between callbacks.
  const cancelRef = useRef<() => void>(() => {});
  const confirmRef2 = useRef<() => void>(() => {});
  const handleUtteranceRef = useRef<(t: string) => void>(() => {});

  // --- timeline helpers ---------------------------------------------------
  const addStep = useCallback((label: string, detail?: string) => {
    const id = uid();
    setTimeline((t) => [...t, { id, label, detail, status: "active" }]);
    return id;
  }, []);
  const doneStep = useCallback((id: string, detail?: string) => {
    setTimeline((t) =>
      t.map((i) =>
        i.id === id ? { ...i, status: "done", detail: detail ?? i.detail } : i
      )
    );
  }, []);
  const failStep = useCallback((id: string, detail?: string) => {
    setTimeline((t) =>
      t.map((i) =>
        i.id === id ? { ...i, status: "error", detail: detail ?? i.detail } : i
      )
    );
  }, []);

  // --- network with deterministic fallback --------------------------------
  const getIntent = useCallback(async (utterance: string): Promise<Intent> => {
    try {
      const res = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utterance }),
      });
      if (!res.ok) throw new Error("bad status");
      return (await res.json()) as Intent;
    } catch {
      return parseIntentLocal(utterance);
    }
  }, []);

  const getPlan = useCallback(
    async (wf: Workflow, obs: Observation): Promise<PlannerOutput> => {
      const input = buildPlannerInput(wf, obs);
      try {
        const res = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error("bad status");
        const data = (await res.json()) as PlannerOutput & { source?: string };
        setPlannerSource(data.source || "");
        return data;
      } catch {
        setPlannerSource("mock-local");
        return planLocal(input);
      }
    },
    []
  );

  const buildPlannerInput = (wf: Workflow, obs: Observation): PlannerInput => {
    const session = sessionStore.get();
    const elements: PlannerInput["workflow"]["elements"] = {};
    for (const [id, el] of Object.entries(wf.elements)) {
      elements[id] = {
        type: el.type,
        label: el.label,
        state: el.state,
        options: el.options,
        sessionKey: el.sessionKey,
      };
    }
    return {
      task: {
        intent: intentRef.current?.intent || "",
        entities: entitiesRef.current,
      },
      current_page: {
        id: obs.state,
        visible_elements: obs.visible_elements,
        values: obs.values,
        field_errors: obs.field_errors,
        has_result: obs.has_result,
      },
      workflow: {
        id: wf.workflow_id,
        description: wf.description,
        required_inputs: wf.required_inputs,
        elements,
      },
      session_known: {
        pan: Boolean(session.user.pan),
        aadhaar: Boolean(session.user.aadhaar),
        assessment_year: true,
      },
    };
  };

  // --- LLM field interpreter ---------------------------------------------
  const buildInterpretInput = (
    mode: InterpretInput["mode"],
    utterance: string
  ): InterpretInput => {
    const wf = workflowRef.current!;
    const user = sessionStore.get().user as unknown as Record<
      string,
      string | null
    >;
    const inputEls = Object.entries(wf.elements).filter(
      ([, el]) => el.type === "input" && el.sessionKey
    );
    const fields = inputEls.map(([, el]) => ({
      key: el.sessionKey as string,
      label: el.label,
      format: el.format ?? "",
      current: user[el.sessionKey as string] ?? "",
    }));

    let awaited: InterpretInput["awaited"];
    const p = pendingRef.current;
    if (mode === "awaiting_input" && p?.kind === "input") {
      const el = inputEls.find(([, e]) => e.sessionKey === p.field)?.[1];
      awaited = {
        key: p.field,
        label: el?.label ?? p.field,
        format: el?.format ?? "",
        current: answerBufferRef.current,
      };
    }
    return {
      utterance,
      mode,
      workflow: { id: wf.workflow_id, description: wf.description },
      awaited,
      fields,
    };
  };

  const interpret = useCallback(
    async (
      mode: InterpretInput["mode"],
      utterance: string
    ): Promise<InterpretOutput> => {
      const input = buildInterpretInput(mode, utterance);
      try {
        const res = await fetch("/api/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error("bad status");
        const data = (await res.json()) as InterpretOutput & {
          source?: string;
        };
        if (data.source) setPlannerSource(data.source);
        return data;
      } catch {
        return interpretLocal(input);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // --- the observe -> plan -> validate -> execute loop --------------------
  const drive = useCallback(async () => {
    const wf = workflowRef.current;
    const ex = executorRef.current;
    if (!wf || !ex || drivingRef.current) return;
    drivingRef.current = true;
    setRunning(true);
    try {
      for (let step = 0; step < 16; step++) {
        const obs = observe(wf);

        if (obs.state === "result" && obs.has_result) {
          await complete();
          return;
        }

        const plan = await getPlan(wf, obs);

        if (plan.status === "error") {
          setStatus(plan.message || "Planning error.");
          return;
        }
        if (plan.status === "complete") {
          await complete();
          return;
        }
        if (plan.needs_user_input && plan.needs_user_input.length > 0) {
          const ni = plan.needs_user_input[0];
          answerBufferRef.current = "";
          setPending({ kind: "input", field: ni.field, prompt: ni.prompt });
          setStatus(ni.prompt);
          return; // resumes when the user provides input
        }
        if (plan.needs_confirmation && !confirmRef.current) {
          setPending({
            kind: "confirmation",
            summary:
              plan.confirmation_summary || "Please confirm this action.",
          });
          setStatus("Waiting for your confirmation before submitting.");
          return;
        }

        let submitted = false;
        for (const action of plan.actions) {
          const label = describe(action, wf);
          const v = validateAction(action, wf, obs.state);
          const id = addStep(label);
          if (!v.valid) {
            failStep(id, `Blocked by validator: ${v.reason}`);
            setStatus(`Action blocked: ${v.reason}`);
            return;
          }
          await ex.highlight(action.element_id);
          const r = await ex.execute(action);
          ex.clearHighlights();
          if (!r.success) {
            failStep(id, r.message);
            setStatus(`Execution failed: ${r.message}`);
            return;
          }
          doneStep(id, execDetail(action, wf));
          if (wf.elements[action.element_id || ""]?.type === "button")
            submitted = true;
          await wait(500);
        }

        confirmRef.current = false; // consume any confirmation

        if (submitted) await waitForSettle(wf);
        await wait(300);

        // Recoverable failure: inline validation error after an attempt.
        const after = observe(wf);
        const errorEntries = Object.entries(after.field_errors);
        if (errorEntries.length > 0) {
          const [elId, msg] = errorEntries[0];
          const key = wf.elements[elId]?.sessionKey || "pan";
          const eid = addStep("Validation error");
          failStep(eid, msg);
          sessionStore.setField(key, null);
          answerBufferRef.current = "";
          setPending({
            kind: "input",
            field: key,
            prompt: `${msg} Please say or type a valid ${key.toUpperCase()}.`,
          });
          setStatus(msg);
          return;
        }
      }
      setStatus("Stopped after too many steps.");
    } finally {
      drivingRef.current = false;
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addStep, doneStep, failStep, getPlan]);

  const complete = useCallback(async () => {
    const r = replicaStore.get().result;
    setResult(r);
    const id = addStep("Result displayed");
    if (r) {
      doneStep(id, r.headline);
      if (r.status === "error") {
        setStatus(`${r.headline}. You can try again with different details.`);
      } else {
        setStatus(`Done — ${r.headline}.`);
      }
      speak(`${r.headline}. ${r.detail}`, setSpeaking);
    } else {
      doneStep(id);
      setStatus("Workflow complete.");
    }
  }, [addStep, doneStep]);

  // --- public actions -----------------------------------------------------
  const handleUtterance = useCallback(
    async (text: string) => {
      // Fresh top-level command: restart the replica journey so repeat
      // requests navigate again from the beginning.
      replicaStore.softReset();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      setResult(null);
      setTimeline([]);
      setPending(null);
      confirmRef.current = false;
      answerBufferRef.current = "";
      setTranscript(text);
      const sid = addStep("Understanding request", text);
      const parsed = await getIntent(text);
      setIntent(parsed);
      intentRef.current = parsed;

      if (parsed.intent === "unknown" || parsed.confidence < 0.5) {
        failStep(sid, "Could not confidently understand the request.");
        setStatus(
          'Sorry, I couldn\'t understand. Try "Check my refund status" or "Link my PAN with Aadhaar".'
        );
        return;
      }
      doneStep(sid, `Intent: ${parsed.intent} · ${parsed.language}`);

      // Merge entities the intent step may have missed (e.g. a PAN spoken in
      // a conversational sentence), so an explicit new value always wins.
      const extra = extractEntities(text);
      const merged: Record<string, string> = { ...parsed.entities };
      if (extra.pan) merged.pan = extra.pan;
      if (extra.aadhaar) merged.aadhaar = extra.aadhaar;
      entitiesRef.current = { ...merged };

      const lower = text.toLowerCase();
      const wantsNew = (fieldPattern: string) =>
        new RegExp(
          `(another|new|different|change|update|correct|naya|naye|nayi|dusra|doosra|badal|galat|wrong)[^.]{0,25}(${fieldPattern})|(${fieldPattern})[^.]{0,25}(another|new|different|change|update|correct|naya|naye|nayi|dusra|doosra|badal|galat|wrong)`,
          "i"
        ).test(lower);

      // PAN: use an explicit value; else if the user asked for a different one
      // without a clean value, clear the stored one so we prompt for it.
      if (merged.pan) sessionStore.setPan(merged.pan);
      else if (wantsNew("pan")) sessionStore.setField("pan", null);

      if (merged.aadhaar) sessionStore.setAadhaar(merged.aadhaar);
      else if (wantsNew("aadhaar|aadhar|adhaar|adhar"))
        sessionStore.setField("aadhaar", null);

      if (merged.assessment_year)
        sessionStore.setAssessmentYear(merged.assessment_year);

      const wf = getWorkflowForIntent(parsed.intent);
      if (!wf) {
        setStatus("No workflow is available for that request yet.");
        return;
      }
      workflowRef.current = wf;
      executorRef.current = new Executor(wf);
      const fid = addStep("Matched workflow", wf.description);
      doneStep(fid);

      await drive();
    },
    [addStep, doneStep, failStep, getIntent, drive]
  );

  /** Persist a field value to both the session and (if visible) the replica. */
  const commitField = useCallback((key: string, value: string) => {
    sessionStore.setField(key, value);
    entitiesRef.current = { ...entitiesRef.current, [key]: value };
    if (key === "pan" || key === "aadhaar" || key === "assessmentYear") {
      replicaStore.setField(key as StoreField, value);
    }
  }, []);

  const provideInput = useCallback(
    async (value: string) => {
      const p = pendingRef.current;
      if (!p || p.kind !== "input") return;

      const out = await interpret("awaiting_input", value);

      switch (out.action) {
        case "cancel":
          cancelRef.current();
          return;
        case "new_request":
          handleUtteranceRef.current(value);
          return;
        case "clear": {
          const key = out.field || p.field;
          if (key === p.field) answerBufferRef.current = "";
          sessionStore.setField(key, null);
          if (key === "pan" || key === "aadhaar" || key === "assessmentYear")
            replicaStore.setField(key as StoreField, "");
          const id = addStep(`Cleared ${labelFor(key)}`);
          doneStep(id);
          setStatus(`Cleared ${labelFor(key)}. Please provide it again.`);
          return; // keep pending
        }
        case "provide":
        case "correct":
        case "append": {
          const key = out.field || p.field;
          const val = out.value ?? "";
          if (key === p.field) answerBufferRef.current = val;

          if (!isValidFor(key, val)) {
            setStatus(
              val
                ? `I have "${maskFor(key, val)}" so far — please continue or correct it.`
                : `I couldn't get a valid ${labelFor(key)}. Please try again.`
            );
            return; // keep pending
          }

          commitField(key, val);
          const id = addStep(`Received ${labelFor(key)}`);
          doneStep(id, maskFor(key, val));

          if (key !== p.field) {
            // Corrected a different field; still need the awaited one.
            setStatus(`Updated ${labelFor(key)}. ${p.prompt}`);
            return;
          }
          answerBufferRef.current = "";
          setPending(null);
          drive();
          return;
        }
        default:
          setStatus(
            out.message ||
              `I didn't catch a valid ${labelFor(p.field)}. Please try again.`
          );
          return;
      }
    },
    [interpret, commitField, addStep, doneStep, drive]
  );

  const handleConfirmSpeech = useCallback(
    async (text: string) => {
      const p = pendingRef.current;
      if (!p || p.kind !== "confirmation") return;

      const out = await interpret("awaiting_confirmation", text);
      switch (out.action) {
        case "confirm":
          confirmRef2.current();
          return;
        case "cancel":
          cancelRef.current();
          return;
        case "new_request":
          handleUtteranceRef.current(text);
          return;
        case "provide":
        case "correct": {
          const key = out.field;
          const val = out.value ?? "";
          if (key && isValidFor(key, val)) {
            commitField(key, val);
            setPending(null);
            confirmRef.current = false;
            const id = addStep(`Corrected ${labelFor(key)}`);
            doneStep(id, maskFor(key, val));
            setStatus(`Updated ${labelFor(key)}. Re-checking…`);
            drive();
            return;
          }
          setStatus("Sorry, I couldn't apply that correction.");
          return;
        }
        default:
          setStatus(
            "Please confirm or cancel — say 'yes' to proceed or 'no' to stop."
          );
          return;
      }
    },
    [interpret, commitField, addStep, doneStep, drive]
  );

  const confirm = useCallback(() => {
    setPending(null);
    confirmRef.current = true;
    const id = addStep("User confirmed");
    doneStep(id);
    drive();
  }, [addStep, doneStep, drive]);

  const cancel = useCallback(() => {
    setPending(null);
    confirmRef.current = false;
    const id = addStep("Cancelled by user");
    failStep(id);
    setStatus("Cancelled. You can start a new request.");
  }, [addStep, failStep]);

  // Keep function refs current so earlier-defined callbacks can call these.
  cancelRef.current = cancel;
  confirmRef2.current = confirm;
  handleUtteranceRef.current = handleUtterance;

  /** Route a voice/text input to a pending prompt, confirmation, or new task. */
  const submitVoice = useCallback(
    (text: string) => {
      const p = pendingRef.current;
      if (p?.kind === "input") provideInput(text);
      else if (p?.kind === "confirmation") handleConfirmSpeech(text);
      else handleUtterance(text);
    },
    [provideInput, handleConfirmSpeech, handleUtterance]
  );

  const reset = useCallback(() => {
    replicaStore.reset();
    sessionStore.reset();
    confirmRef.current = false;
    intentRef.current = null;
    entitiesRef.current = {};
    setTimeline([]);
    setIntent(null);
    setTranscript("");
    setResult(null);
    setPending(null);
    setSpeaking(false);
    setPlannerSource("");
    setStatus("Reset. Ready for a new request.");
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  const state: VoiceGovState = {
    transcript,
    intent,
    timeline,
    status,
    pending,
    running,
    speaking,
    result,
    plannerSource,
  };

  return { state, submitVoice, handleUtterance, provideInput, confirm, cancel, reset };
}

// --- field helpers --------------------------------------------------------
function labelFor(key: string): string {
  switch (key) {
    case "pan":
      return "PAN";
    case "aadhaar":
      return "Aadhaar";
    case "assessmentYear":
    case "assessment_year":
      return "Assessment Year";
    default:
      return key;
  }
}

function isValidFor(key: string, value: string): boolean {
  if (!value) return false;
  if (key === "pan") return PAN_REGEX.test(value);
  if (key === "aadhaar") return AADHAAR_REGEX.test(value);
  return value.trim().length > 0;
}

function maskFor(key: string, value: string): string {
  if (key === "pan") return maskPan(value);
  if (key === "aadhaar") return maskAadhaar(value);
  return value;
}

// --- helpers --------------------------------------------------------------
function describe(action: Action, wf: Workflow): string {
  const label = action.element_id
    ? wf.elements[action.element_id]?.label ?? action.element_id
    : "";
  switch (action.action) {
    case "click":
    case "navigate":
      return `Open ${label}`;
    case "fill":
      return `Enter ${label}`;
    case "select":
      return `Select ${label}${action.value ? `: ${action.value}` : ""}`;
    case "read":
      return `Read ${label}`;
    case "highlight":
      return `Highlight ${label}`;
    case "scroll":
      return `Scroll to ${label}`;
    default:
      return action.action;
  }
}

function execDetail(action: Action, wf: Workflow): string | undefined {
  if (action.action === "select") return action.value;
  if (action.action === "fill") {
    const el = wf.elements[action.element_id || ""];
    const user = sessionStore.get().user as unknown as Record<
      string,
      string | null
    >;
    const key = el?.sessionKey;
    const raw = key ? user[key] : undefined;
    if (raw && el?.field === "pan") return maskPan(raw);
    if (raw && el?.field === "aadhaar") return maskAadhaar(raw);
    return el?.label;
  }
  return wf.elements[action.element_id || ""]?.label;
}

function speak(text: string, setSpeaking?: (v: boolean) => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-IN";
  u.rate = 1;
  u.onstart = () => setSpeaking?.(true);
  u.onend = () => setSpeaking?.(false);
  u.onerror = () => setSpeaking?.(false);
  window.speechSynthesis.speak(u);
  // Safety net: Chrome sometimes never fires onend, which would leave the
  // assistant "speaking" forever and ignore all further mic input. Clear the
  // flag after a bounded time based on the text length.
  const maxMs = Math.min(15000, 2500 + text.length * 60);
  setTimeout(() => setSpeaking?.(false), maxMs);
}

async function waitForSettle(wf: Workflow) {
  for (let i = 0; i < 50; i++) {
    if (!observe(wf).loading) return;
    await wait(100);
  }
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

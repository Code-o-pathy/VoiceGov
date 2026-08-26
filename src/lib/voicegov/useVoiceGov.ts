"use client";

import { useCallback, useRef, useState } from "react";
import type { Action, PlannerOutput } from "@/schemas/actions";
import type { Intent, PlannerInput, Observation } from "@/schemas/planner";
import type { Workflow } from "@/schemas/workflow";
import { observe } from "@/lib/observer/observer";
import { validateAction } from "@/lib/validator/validator";
import { Executor } from "@/lib/executor/executor";
import { getWorkflowForIntent } from "@/workflows/registry";
import { sessionStore } from "@/lib/session/store";
import { parseIntentLocal } from "@/lib/intent/mockIntent";
import { planLocal } from "@/lib/planner/mockPlanner";
import { replicaStore } from "@/lib/replica/store";
import { normalizePan, PAN_REGEX, type RefundResult } from "@/lib/replica/mockApi";

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
  result: RefundResult | null;
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
  const [result, setResult] = useState<RefundResult | null>(null);
  const [plannerSource, setPlannerSource] = useState("");

  const workflowRef = useRef<Workflow | null>(null);
  const executorRef = useRef<Executor | null>(null);
  const intentRef = useRef<Intent | null>(null);
  const entitiesRef = useRef<Record<string, string>>({});
  const confirmRef = useRef(false);
  const drivingRef = useRef(false);

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
        assessment_year: true,
      },
    };
  };

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
          if (action.element_id === "submit_refund") submitted = true;
          await wait(500);
        }

        confirmRef.current = false; // consume any confirmation

        if (submitted) await waitForSettle(wf);
        await wait(300);

        // Recoverable failure: inline validation error after an attempt.
        const after = observe(wf);
        if (Object.keys(after.field_errors).length > 0) {
          const msg =
            after.field_errors.pan_input || "Please correct your input.";
          const eid = addStep("Validation error");
          failStep(eid, msg);
          sessionStore.setPan(null);
          setPending({
            kind: "input",
            field: "pan",
            prompt: `${msg} Please say or type a valid PAN.`,
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
      if (r.status === "no_records") {
        setStatus(
          "No refund records found. You can try again with a different PAN."
        );
      } else {
        setStatus(`Done — ${r.headline}.`);
      }
      speak(`${r.headline}. ${r.detail}`);
    } else {
      doneStep(id);
      setStatus("Workflow complete.");
    }
  }, [addStep, doneStep]);

  // --- public actions -----------------------------------------------------
  const handleUtterance = useCallback(
    async (text: string) => {
      setTranscript(text);
      setResult(null);
      const sid = addStep("Understanding request", text);
      const parsed = await getIntent(text);
      setIntent(parsed);
      intentRef.current = parsed;

      if (parsed.intent === "unknown" || parsed.confidence < 0.5) {
        failStep(sid, "Could not confidently understand the request.");
        setStatus(
          'Sorry, I couldn\'t understand. Try: "Check my income tax refund status".'
        );
        return;
      }
      doneStep(sid, `Intent: ${parsed.intent} · ${parsed.language}`);

      entitiesRef.current = { ...parsed.entities };
      if (parsed.entities.pan) sessionStore.setPan(parsed.entities.pan);
      if (parsed.entities.assessment_year)
        sessionStore.setAssessmentYear(parsed.entities.assessment_year);

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

  const provideInput = useCallback(
    (value: string) => {
      const p = pending;
      if (!p || p.kind !== "input") return;
      setPending(null);

      if (p.field === "pan") {
        const pan = normalizePan(value);
        sessionStore.setPan(pan);
        entitiesRef.current = { ...entitiesRef.current, pan };
        const id = addStep("Received PAN from user");
        if (PAN_REGEX.test(pan)) doneStep(id, maskPan(pan));
        else doneStep(id, `${maskPan(pan)} (will be validated)`);
      } else if (p.field === "assessment_year") {
        sessionStore.setAssessmentYear(value);
        entitiesRef.current = { ...entitiesRef.current, assessment_year: value };
        const id = addStep("Received Assessment Year");
        doneStep(id, value);
      }
      drive();
    },
    [pending, addStep, doneStep, drive]
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

  /** Route a voice/text input either to a pending prompt or a new request. */
  const submitVoice = useCallback(
    (text: string) => {
      if (pending?.kind === "input") provideInput(text);
      else handleUtterance(text);
    },
    [pending, provideInput, handleUtterance]
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
    result,
    plannerSource,
  };

  return { state, submitVoice, handleUtterance, provideInput, confirm, cancel, reset };
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
  if (action.action === "fill" && action.element_id === "pan_input") {
    const pan = sessionStore.get().user.pan;
    return pan ? maskPan(pan) : undefined;
  }
  return wf.elements[action.element_id || ""]?.label;
}

function maskPan(pan: string): string {
  if (pan.length <= 2) return "\u2022".repeat(pan.length);
  return "\u2022".repeat(pan.length - 1) + pan.slice(-1);
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-IN";
  u.rate = 1;
  window.speechSynthesis.speak(u);
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

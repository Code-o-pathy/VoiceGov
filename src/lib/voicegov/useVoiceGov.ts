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
import { parsePan, parseAadhaar } from "@/lib/interpreter/fieldParse";
import { replicaStore } from "@/lib/replica/store";
import {
  PAN_REGEX,
  AADHAAR_REGEX,
  type ServiceResult,
} from "@/lib/replica/mockApi";
import type { StoreField } from "@/schemas/workflow";
import type { InterpretInput, InterpretOutput } from "@/schemas/interpret";
import { FIELD_LABELS } from "@/lib/services/catalog";

export type StepStatus = "active" | "done" | "error";
export interface TimelineItem {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

export type Pending =
  | { kind: "input"; field: string; prompt: string; current?: string }
  | { kind: "verify"; field: string; value: string; prompt: string }
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
  // BCP-47 language for spoken replies, derived from the user's input language.
  const replyLangRef = useRef("en-IN");
  const entitiesRef = useRef<Record<string, string>>({});
  const confirmRef = useRef(false);
  const drivingRef = useRef(false);
  // Accumulates spoken fragments while answering a PAN/Aadhaar prompt so we
  // don't act on a partial value like "ABCDE".
  const answerBufferRef = useRef("");
  // Fields whose stored value the user has already confirmed (or just gave)
  // this run, so we don't re-ask every field before using it.
  const verifiedRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Pending | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Function refs to sidestep declaration-order between callbacks.
  const cancelRef = useRef<() => void>(() => {});
  const confirmRef2 = useRef<() => void>(() => {});
  const handleUtteranceRef = useRef<(t: string) => void>(() => {});

  // Set the status line AND read it aloud, so prompts/questions are spoken.
  const announce = useCallback((text: string) => {
    setStatus(text);
    speak(text, setSpeaking, replyLangRef.current);
  }, []);

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
      session_known: buildSessionKnown(wf, session.user),
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

  // Detect when an utterance is really a NEW service request for a DIFFERENT
  // workflow, so the user can change their mind mid-flow (e.g. asked for a PAN
  // but now says "link my Aadhaar"). Same-workflow phrases are left to the
  // field handlers so a spoken value isn't mistaken for a switch.
  const isWorkflowSwitch = useCallback((text: string): boolean => {
    const parsed = parseIntentLocal(text);
    if (parsed.intent === "unknown" || parsed.confidence < 0.7) return false;
    const wf = getWorkflowForIntent(parsed.intent);
    if (!wf) return false;
    const cur = workflowRef.current;
    return !cur || wf.workflow_id !== cur.workflow_id;
  }, []);

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

        // Verify any stored value with the user before using it, e.g.
        // "I have your PAN as ABCDE1234F — use it, or a different one?".
        const user = sessionStore.get().user as unknown as Record<
          string,
          string | null
        >;
        const toVerify = Object.values(wf.elements).find(
          (el) =>
            el.type === "input" &&
            el.state === obs.state &&
            el.sessionKey &&
            (el.sessionKey === "pan" || el.sessionKey === "aadhaar") &&
            user[el.sessionKey] &&
            !verifiedRef.current.has(el.sessionKey)
        );
        if (toVerify?.sessionKey) {
          const key = toVerify.sessionKey;
          const val = user[key] as string;
          answerBufferRef.current = "";
          const prompt = `I have your ${labelFor(key)} as ${maskFor(
            key,
            val
          )}. Say "yes" to use it, or tell me a different ${labelFor(key)}.`;
          setPending({ kind: "verify", field: key, value: val, prompt });
          announce(prompt);
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
          announce(ni.prompt);
          return; // resumes when the user provides input
        }
        if (plan.needs_confirmation && !confirmRef.current) {
          const summary = buildConfirmSummary(wf, obs.state);
          setPending({ kind: "confirmation", summary });
          announce(summary);
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
          verifiedRef.current.delete(key);
          answerBufferRef.current = "";
          const prompt = `${msg} Please say or type a valid ${labelFor(key)}.`;
          setPending({ kind: "input", field: key, prompt });
          announce(prompt);
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
      speak(`${r.headline}. ${r.detail}`, setSpeaking, replyLangRef.current);
    } else {
      doneStep(id);
      setStatus("Workflow complete.");
    }
  }, [addStep, doneStep]);

  // --- public actions -----------------------------------------------------
  const handleUtterance = useCallback(
    async (text: string) => {
      // Understand the request FIRST — don't tear down the current page/state
      // until we know it's a valid new command (otherwise an unrecognised
      // phrase would jarringly send the user back to the home page).
      setTranscript(text);
      const parsed = await getIntent(text);
      setIntent(parsed);
      intentRef.current = parsed;
      // Reply in the language the user spoke: Hindi/Hinglish -> hi-IN voice.
      replyLangRef.current =
        parsed.language === "english" ? "en-IN" : "hi-IN";

      if (parsed.intent === "unknown" || parsed.confidence < 0.5) {
        const uid2 = addStep("Understanding request", text);
        failStep(uid2, "Could not confidently understand the request.");
        setStatus(
          'Sorry, I couldn\'t understand. Try "Check my refund status", "Link my PAN with Aadhaar", or say "change my PAN".'
        );
        return; // stay exactly where we are
      }

      // Valid new command: restart the replica journey from the beginning.
      replicaStore.softReset();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      setResult(null);
      setTimeline([]);
      setPending(null);
      confirmRef.current = false;
      answerBufferRef.current = "";
      verifiedRef.current = new Set();
      const sid = addStep("Understanding request", text);
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
      // A value spoken now counts as verified (no need to re-confirm it).
      if (merged.pan) {
        sessionStore.setPan(merged.pan);
        verifiedRef.current.add("pan");
      } else if (wantsNew("pan")) sessionStore.setField("pan", null);

      if (merged.aadhaar) {
        sessionStore.setAadhaar(merged.aadhaar);
        verifiedRef.current.add("aadhaar");
      } else if (wantsNew("aadhaar|aadhar|adhaar|adhar"))
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
    replicaStore.setField(key as StoreField, value);
  }, []);

  const provideInput = useCallback(
    async (value: string) => {
      const p = pendingRef.current;
      if (!p || p.kind !== "input") return;

      // Changed their mind → a different service. Abandon this prompt.
      if (isWorkflowSwitch(value)) {
        handleUtteranceRef.current(value);
        return;
      }

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
          verifiedRef.current.add(key);
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
    [interpret, commitField, addStep, doneStep, drive, isWorkflowSwitch]
  );

  const handleConfirmSpeech = useCallback(
    async (text: string) => {
      const p = pendingRef.current;
      if (!p || p.kind !== "confirmation") return;
      const lower = text.toLowerCase();

      // Changed their mind → a different service.
      if (isWorkflowSwitch(text)) {
        handleUtteranceRef.current(text);
        return;
      }

      const applyCorrection = (key: string, val: string) => {
        commitField(key, val);
        verifiedRef.current.add(key);
        setPending(null);
        confirmRef.current = false;
        const id = addStep(`Corrected ${labelFor(key)}`);
        doneStep(id, maskFor(key, val));
        setStatus(`Updated ${labelFor(key)}. Re-checking…`);
        drive();
      };
      const openFieldEdit = (key: string) => {
        const user = sessionStore.get().user as unknown as Record<
          string,
          string | null
        >;
        const cur = user[key] || "";
        confirmRef.current = false;
        verifiedRef.current.delete(key);
        answerBufferRef.current = "";
        const prompt = `Sure — say your ${labelFor(
          key
        )}, or edit it in the box below and press Send.`;
        setPending({ kind: "input", field: key, prompt, current: cur });
        announce(prompt);
      };

      // Explicit abort.
      if (
        /\b(cancel|abort|stop|ruko|ruk|band|chhod|chod|nevermind|never mind|forget it)\b/i.test(
          lower
        )
      ) {
        cancelRef.current();
        return;
      }

      // A value spoken now -> correct that field directly (handles spelled /
      // Hinglish input like "A B C D ji 1234 F").
      const panVal = parsePan(text);
      if (panVal) return applyCorrection("pan", panVal);
      const aadVal = parseAadhaar(text);
      if (aadVal) return applyCorrection("aadhaar", aadVal);

      // "no" / "change" / "wrong" -> open the relevant field for editing.
      if (
        /\b(no|nahi|nahin|change|edit|wrong|galat|different|another|update|badal|correct|fix)\b/i.test(
          lower
        )
      ) {
        const key = /(aadhaar|aadhar|adhaar|adhar|आधार)/.test(lower)
          ? "aadhaar"
          : "pan";
        openFieldEdit(key);
        return;
      }

      // Yes / confirm.
      if (VERIFY_YES.test(lower)) {
        confirmRef2.current();
        return;
      }

      // Anything subtle: let the interpreter decide.
      const out = await interpret("awaiting_confirmation", text);
      if (out.action === "confirm") confirmRef2.current();
      else if (out.action === "cancel") cancelRef.current();
      else if (
        (out.action === "provide" || out.action === "correct") &&
        out.field &&
        isValidFor(out.field, out.value || "")
      )
        applyCorrection(out.field, out.value as string);
      else if (out.action === "new_request") handleUtteranceRef.current(text);
      else announce(p.summary);
    },
    [interpret, commitField, addStep, doneStep, drive, announce, isWorkflowSwitch]
  );

  // Respond to "I have your PAN as X — use it, or a different one?".
  const verifyResponse = useCallback(
    async (text: string) => {
      const p = pendingRef.current;
      if (!p || p.kind !== "verify") return;
      const key = p.field;

      // Changed their mind → a different service.
      if (isWorkflowSwitch(text)) {
        handleUtteranceRef.current(text);
        return;
      }

      // 1. A new/corrected value spoken now wins (handles spelled input).
      const extracted =
        key === "pan"
          ? parsePan(text)
          : key === "aadhaar"
            ? parseAadhaar(text)
            : null;
      if (extracted && isValidFor(key, extracted)) {
        commitField(key, extracted);
        verifiedRef.current.add(key);
        setPending(null);
        const id = addStep(`Updated ${labelFor(key)}`);
        doneStep(id, maskFor(key, extracted));
        drive();
        return;
      }

      // 2. Yes / use it.
      if (VERIFY_YES.test(text)) {
        verifiedRef.current.add(key);
        setPending(null);
        const id = addStep(`Using saved ${labelFor(key)}`);
        doneStep(id, maskFor(key, p.value));
        drive();
        return;
      }

      // 3. No / different -> open an editable input, prefilled with the old
      // value, so the user can fix a character or dictate a new one. We stay on
      // the form (no navigation) and don't submit until it's confirmed.
      if (VERIFY_DIFFERENT.test(text)) {
        const old = p.value;
        sessionStore.setField(key, null);
        replicaStore.setField(key as StoreField, "");
        verifiedRef.current.delete(key);
        answerBufferRef.current = "";
        const id = addStep(`Changing ${labelFor(key)}`);
        doneStep(id);
        const prompt = `Okay, let's update your ${labelFor(
          key
        )}. Say the correct ${labelFor(
          key
        )}, or edit it in the box below and press Send.`;
        setPending({ kind: "input", field: key, prompt, current: old });
        announce(prompt);
        return;
      }

      // 4. Couldn't tell — repeat the question.
      announce(p.prompt);
    },
    [commitField, addStep, doneStep, drive, announce, isWorkflowSwitch]
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
      else if (p?.kind === "verify") verifyResponse(text);
      else if (p?.kind === "confirmation") handleConfirmSpeech(text);
      else handleUtterance(text);
    },
    [provideInput, verifyResponse, handleConfirmSpeech, handleUtterance]
  );

  const reset = useCallback(() => {
    replicaStore.reset();
    sessionStore.reset();
    confirmRef.current = false;
    intentRef.current = null;
    entitiesRef.current = {};
    verifiedRef.current = new Set();
    answerBufferRef.current = "";
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
  return FIELD_LABELS[key] ?? key;
}

/** Which of a workflow's required inputs are already known in the session. */
function buildSessionKnown(
  wf: Workflow,
  user: Record<string, string | null>
): Record<string, boolean> {
  const known: Record<string, boolean> = {};
  for (const el of Object.values(wf.elements)) {
    if (el.type === "input" && el.sessionKey)
      known[el.sessionKey] = Boolean(user[el.sessionKey]);
    if (el.type === "select" && el.sessionKey) known[el.sessionKey] = true;
  }
  return known;
}

const VERIFY_YES =
  /\b(yes|yeah|yep|yup|haan|haa|ha|ok|okay|use it|use this|sahi|theek|thik|correct|right|proceed|go ahead|continue|same|keep)\b/i;
const VERIFY_DIFFERENT =
  /\b(no|nope|nahi|nahin|different|another|change|update|naya|naye|nayi|dusra|doosra|galat|wrong|badal)\b/i;

function buildConfirmSummary(wf: Workflow, state: string): string {
  const user = sessionStore.get().user as unknown as Record<
    string,
    string | null
  >;
  const repValues = replicaStore.get().values;
  const parts: string[] = [];
  for (const el of Object.values(wf.elements)) {
    if (el.state !== state) continue;
    if (el.type === "input" && el.sessionKey) {
      const v = user[el.sessionKey] ?? repValues[el.sessionKey];
      if (v) parts.push(`${el.label} ${maskFor(el.sessionKey, v)}`);
    } else if (el.type === "select" && el.field) {
      const v = repValues[el.field];
      if (v) parts.push(`${el.label} ${v}`);
    }
  }
  const detail = parts.length ? parts.join(", ") : "the entered details";
  return `Please confirm — ${detail}. Say "yes" to submit, or "no" to change something.`;
}

function isValidFor(key: string, value: string): boolean {
  if (!value) return false;
  if (key === "pan") return PAN_REGEX.test(value);
  if (key === "aadhaar") return AADHAAR_REGEX.test(value);
  return value.trim().length > 0;
}

// Show the actual value in spoken/on-screen prompts (this is synthetic demo
// data). Previously PAN/Aadhaar were masked which sounded/looked "censored"
// when read back for confirmation.
function maskFor(_key: string, value: string): string {
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
    return raw || el?.label;
  }
  return wf.elements[action.element_id || ""]?.label;
}

function speak(
  text: string,
  setSpeaking?: (v: boolean) => void,
  lang = "en-IN"
) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  // Pick a voice matching the language when one is installed.
  const voices = window.speechSynthesis.getVoices();
  const base = lang.split("-")[0];
  const voice =
    voices.find((v) => v.lang === lang) ||
    voices.find((v) => v.lang.startsWith(base));
  if (voice) u.voice = voice;
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

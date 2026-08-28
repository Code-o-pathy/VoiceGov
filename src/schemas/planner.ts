import type { ReplicaState } from "./workflow";

/** Output of the intent parser. Identifies the task, not DOM selectors. */
export interface Intent {
  intent: string;
  entities: Record<string, string>;
  language: "english" | "hindi" | "hinglish";
  confidence: number;
}

/** Compact observation of the replica, produced by the observer layer. */
export interface Observation {
  state: ReplicaState;
  /** Semantic ids currently visible/actionable. */
  visible_elements: string[];
  /** Current form values keyed by semantic id (only where safe). */
  values: Record<string, string>;
  loading: boolean;
  field_errors: Record<string, string>;
  has_result: boolean;
  result_status?: string;
}

/** Everything the planner receives for a single planning step. */
export interface PlannerInput {
  task: {
    intent: string;
    entities: Record<string, string>;
  };
  current_page: {
    id: ReplicaState;
    visible_elements: string[];
    values: Record<string, string>;
    field_errors: Record<string, string>;
    has_result: boolean;
  };
  workflow: {
    id: string;
    description: string;
    required_inputs: string[];
    elements: Record<
      string,
      {
        type: string;
        label: string;
        state: string;
        options?: string[];
        sessionKey?: string;
      }
    >;
  };
  /** Which required inputs are already known (booleans only — no raw values). */
  session_known: Record<string, boolean>;
}

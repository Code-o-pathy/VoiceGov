/**
 * Semantic website model. This is the ONLY thing the LLM sees about the
 * replica. It maps human-meaningful semantic element ids to metadata. The
 * actual DOM selector (`dom`) lives here but is used exclusively by the
 * application-owned executor — never exposed to the model in prompts.
 */
export type ElementType = "link" | "input" | "select" | "button" | "result";

/** Page states of the replica relevant to a workflow. */
export type ReplicaState =
  | "home"
  | "services"
  | "refund_form"
  | "aadhaar_form"
  | "result";

/** Fields the replica store can hold and bind inputs to. */
export type StoreField = "pan" | "assessmentYear" | "aadhaar";

export interface SemanticElement {
  /** Kind of control. */
  type: ElementType;
  /** Human label shown on the replica (mirrors original terminology). */
  label: string;
  /** Application-owned DOM selector. Never sent to the LLM. */
  dom: string;
  /** The replica page-state on which this element is present/actionable. */
  state: ReplicaState;
  /** Allowed options for `select` elements. */
  options?: string[];
  /** Default session binding, e.g. "user.pan". */
  valueRef?: string;
  /** Which replica-store field this control reads/writes (inputs/selects). */
  field?: StoreField;
  /** Which session key must be known to fill this input (e.g. "pan"). */
  sessionKey?: string;
  /** Human/normalisation hint for the interpreter, e.g. PAN format. */
  format?: string;
  /** Whether acting on this element is a consequential action. */
  consequential?: boolean;
}

export interface Workflow {
  workflow_id: string;
  /** Semantic entry point (the service section this workflow lives under). */
  entry_point: string;
  description: string;
  /** Session inputs required to complete the workflow. */
  required_inputs: string[];
  /** Ordered page-states the workflow moves through. */
  states: ReplicaState[];
  elements: Record<string, SemanticElement>;
}

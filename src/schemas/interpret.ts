import { z } from "zod";

/**
 * The field interpreter turns a free-form user reply (spoken or typed) into a
 * structured operation on a form field, WITH full context: which field is being
 * asked for, its format, and its current partial value. This replaces brittle
 * hardcoded extraction with LLM (or deterministic) understanding.
 */
export interface InterpretField {
  key: string; // session key, e.g. "pan"
  label: string; // human label, e.g. "PAN"
  format: string; // how to normalise/validate, e.g. "10 chars ABCDE1234F"
  current: string; // current (possibly partial) value
}

export interface InterpretInput {
  utterance: string;
  /** Whether we're collecting a value or waiting for a yes/no confirmation. */
  mode: "awaiting_input" | "awaiting_confirmation";
  workflow: { id: string; description: string };
  /** The field currently being collected (when mode === awaiting_input). */
  awaited?: InterpretField;
  /** All fillable fields of the workflow (enables mid-flow corrections). */
  fields: InterpretField[];
}

export const InterpretActions = [
  "provide", // give a value for the awaited field
  "correct", // change a (possibly different) field
  "append", // add to the current partial value
  "clear", // wipe a field
  "confirm", // yes / go ahead
  "cancel", // no / stop
  "new_request", // a different task entirely
  "none", // couldn't extract anything useful
] as const;

export const InterpretOutputSchema = z
  .object({
    action: z.enum(InterpretActions),
    field: z.string().optional(),
    /** The resulting FULL value after applying the operation (normalised). */
    value: z.string().optional(),
    message: z.string().optional(),
  })
  .strict();

export type InterpretOutput = z.infer<typeof InterpretOutputSchema>;

import { z } from "zod";

/**
 * The complete, application-owned action space.
 * The LLM may ONLY emit these action types. There is deliberately no
 * `execute_code`, no arbitrary selector, and no arbitrary URL navigation.
 */
export const ACTION_TYPES = [
  "navigate",
  "click",
  "fill",
  "select",
  "scroll",
  "read",
  "highlight",
  "request_user_input",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/**
 * A single semantic action. `element_id` refers to a semantic element in the
 * active workflow registry (never a DOM selector). Values are either literal
 * (`value`) or references into the session (`value_ref`, e.g. "user.pan").
 */
export const ActionSchema = z
  .object({
    action: z.enum(ACTION_TYPES),
    element_id: z.string().optional(),
    value: z.string().optional(),
    value_ref: z.string().optional(),
    field: z.string().optional(),
    prompt: z.string().optional(),
  })
  .strict();

export type Action = z.infer<typeof ActionSchema>;

export const NeedInputSchema = z
  .object({
    field: z.string(),
    prompt: z.string(),
  })
  .strict();

export type NeedInput = z.infer<typeof NeedInputSchema>;

export const PlannerStatus = z.enum([
  "ready",
  "need_input",
  "need_confirmation",
  "complete",
  "error",
]);

export const PlannerOutputSchema = z
  .object({
    status: PlannerStatus,
    actions: z.array(ActionSchema).default([]),
    needs_user_input: z.array(NeedInputSchema).default([]),
    needs_confirmation: z.boolean().default(false),
    confirmation_summary: z.string().optional(),
    message: z.string().optional(),
  })
  .strict();

export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

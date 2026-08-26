"use client";

import type { Action } from "@/schemas/actions";
import type { Workflow } from "@/schemas/workflow";
import { buildElementRegistry } from "@/workflows/registry";
import { sessionStore } from "@/lib/session/store";

export interface ExecResult {
  success: boolean;
  message: string;
}

const HIGHLIGHT_CLASS = "vg-highlight";

/**
 * Deterministic DOM executor. Maps semantic actions to the replica's real DOM
 * using framework-compatible input/change events. Selectors live only here
 * (via the element registry) — never in LLM output.
 */
export class Executor {
  private registry: Record<string, string>;

  constructor(workflow: Workflow) {
    this.registry = buildElementRegistry(workflow);
  }

  private el(elementId?: string): HTMLElement | null {
    if (!elementId) return null;
    const selector = this.registry[elementId];
    if (!selector) return null;
    return document.querySelector<HTMLElement>(selector);
  }

  /** Visually highlight an element before acting on it. */
  async highlight(elementId?: string): Promise<void> {
    const node = this.el(elementId);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.classList.add(HIGHLIGHT_CLASS);
    await wait(650);
  }

  clearHighlights(): void {
    document
      .querySelectorAll(`.${HIGHLIGHT_CLASS}`)
      .forEach((n) => n.classList.remove(HIGHLIGHT_CLASS));
  }

  async execute(action: Action): Promise<ExecResult> {
    switch (action.action) {
      case "navigate":
      case "click":
        return this.click(action);
      case "fill":
        return this.fill(action);
      case "select":
        return this.select(action);
      case "scroll":
        await this.highlight(action.element_id);
        return { success: true, message: "scrolled" };
      case "read":
        return this.read(action);
      case "highlight":
        await this.highlight(action.element_id);
        return { success: true, message: "highlighted" };
      default:
        return { success: false, message: `Unhandled action ${action.action}` };
    }
  }

  private click(action: Action): ExecResult {
    const node = this.el(action.element_id) as HTMLElement | null;
    if (!node) return { success: false, message: "Element not found in DOM." };
    node.click();
    return { success: true, message: `clicked ${action.element_id}` };
  }

  private fill(action: Action): ExecResult {
    const node = this.el(action.element_id) as HTMLInputElement | null;
    if (!node) return { success: false, message: "Input not found in DOM." };

    let value = action.value;
    if (action.value_ref) {
      value = sessionStore.resolveRef(action.value_ref);
    }
    if (value == null) {
      return { success: false, message: "No value resolved for fill." };
    }

    setNativeValue(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    return { success: true, message: `filled ${action.element_id}` };
  }

  private select(action: Action): ExecResult {
    const node = this.el(action.element_id) as HTMLSelectElement | null;
    if (!node) return { success: false, message: "Select not found in DOM." };
    if (action.value == null)
      return { success: false, message: "No value for select." };

    setNativeValue(node, action.value);
    node.dispatchEvent(new Event("change", { bubbles: true }));
    return { success: true, message: `selected ${action.value}` };
  }

  private read(action: Action): ExecResult {
    const node = this.el(action.element_id);
    const text = node?.innerText ?? "";
    return { success: true, message: text };
  }
}

/**
 * The well-known React trick: use the native value setter so React's onChange
 * fires and controlled component state stays in sync.
 */
function setNativeValue(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string
) {
  const proto =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(element, value);
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

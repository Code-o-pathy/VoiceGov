import type { Workflow } from "@/schemas/workflow";

/**
 * Refund Status workflow for the Income Tax e-Filing replica.
 *
 * Journey: Home -> Services -> "Know Your Refund Status" form
 *          -> fill PAN + Assessment Year -> Submit -> Result.
 */
export const refundStatusWorkflow: Workflow = {
  workflow_id: "refund_status",
  entry_point: "income_tax_services",
  description: "Check income tax refund status",
  required_inputs: ["pan", "assessment_year"],
  states: ["home", "services", "refund_form", "result"],
  elements: {
    services_link: {
      type: "link",
      label: "Services",
      dom: "#nav-services-link",
      state: "home",
    },
    refund_status_link: {
      type: "link",
      label: "Know Your Refund Status",
      dom: "#refund-status-link",
      state: "services",
    },
    pan_input: {
      type: "input",
      label: "PAN",
      dom: "#pan-input",
      state: "refund_form",
      field: "pan",
      sessionKey: "pan",
      valueRef: "user.pan",
      format:
        "A 10-character PAN: 5 letters, then 4 digits, then 1 letter. Uppercase, no spaces. Example: ABCDE1234F.",
    },
    assessment_year: {
      type: "select",
      label: "Assessment Year",
      dom: "#assessment-year",
      state: "refund_form",
      field: "assessmentYear",
      options: ["2026-27", "2025-26", "2024-25", "2023-24"],
    },
    submit_refund: {
      type: "button",
      label: "Continue",
      dom: "#submit-refund",
      state: "refund_form",
      consequential: true,
    },
    refund_result: {
      type: "result",
      label: "Refund Status",
      dom: "#service-result",
      state: "result",
    },
  },
};

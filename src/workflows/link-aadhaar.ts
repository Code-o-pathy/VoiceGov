import type { Workflow } from "@/schemas/workflow";

/**
 * Link Aadhaar workflow for the Income Tax e-Filing replica.
 *
 * Journey: Home -> Services -> "Link Aadhaar" form
 *          -> fill PAN + Aadhaar -> Link Aadhaar -> Result.
 */
export const linkAadhaarWorkflow: Workflow = {
  workflow_id: "link_aadhaar",
  entry_point: "income_tax_services",
  description: "Link PAN with Aadhaar",
  required_inputs: ["pan", "aadhaar"],
  states: ["home", "services", "aadhaar_form", "result"],
  elements: {
    services_link: {
      type: "link",
      label: "Services",
      dom: "#nav-services-link",
      state: "home",
    },
    link_aadhaar_link: {
      type: "link",
      label: "Link Aadhaar",
      dom: "#link-aadhaar-link",
      state: "services",
    },
    aadhaar_pan_input: {
      type: "input",
      label: "PAN",
      dom: "#aadhaar-pan-input",
      state: "aadhaar_form",
      field: "pan",
      sessionKey: "pan",
      valueRef: "user.pan",
      format:
        "A 10-character PAN: 5 letters, then 4 digits, then 1 letter. Uppercase, no spaces. Example: ABCDE1234F.",
    },
    aadhaar_number: {
      type: "input",
      label: "Aadhaar Number",
      dom: "#aadhaar-number",
      state: "aadhaar_form",
      field: "aadhaar",
      sessionKey: "aadhaar",
      valueRef: "user.aadhaar",
      format: "A 12-digit Aadhaar number, digits only. Example: 234523452345.",
    },
    link_aadhaar_submit: {
      type: "button",
      label: "Link Aadhaar",
      dom: "#link-aadhaar-submit",
      state: "aadhaar_form",
      consequential: true,
    },
    aadhaar_result: {
      type: "result",
      label: "Link Aadhaar Status",
      dom: "#service-result",
      state: "result",
    },
  },
};

import type { Workflow, SemanticElement } from "@/schemas/workflow";
import {
  PAN_REGEX,
  AADHAAR_REGEX,
  TAN_REGEX,
  normalizePan,
  normalizeAadhaar,
  maskPan,
  maskAadhaar,
  type ServiceResult,
  type ResultRow,
} from "@/lib/replica/mockApi";

/**
 * DATA-DRIVEN SERVICE CATALOG.
 *
 * Every taxpayer service is described declaratively here — its fields, its
 * validation, and its deterministic mock result. The workflow (semantic model),
 * the replica form UI, the services grid, the intent map and the mock backend
 * are all generated from this single source, so adding a service is one entry.
 */

export interface ServiceField {
  key: string; // session + store key
  label: string;
  kind: "input" | "select";
  options?: string[];
  default?: string;
  placeholder?: string;
  /** Interpreter/normalisation hint (also read aloud in prompts). */
  format?: string;
  /** How spoken input should be parsed. */
  parse?: "pan" | "aadhaar" | "digits" | "text";
  /** Return an error message if invalid, else null. */
  validate?: (value: string) => string | null;
  /** How to mask the value in results. */
  mask?: "pan" | "aadhaar";
}

export interface ServiceDef {
  id: string; // also the intent id and workflow id
  title: string;
  description: string;
  icon: string;
  /** Keyword/synonym hints for deterministic intent matching. */
  keywords: string[];
  fields: ServiceField[];
  submitLabel: string;
  consequential: boolean;
  /** Deterministic result builder. Assumes fields already validated. */
  run: (values: Record<string, string>) => ServiceResult;
}

// --- shared field builders -------------------------------------------------
const AY_OPTIONS = ["2025-26", "2024-25", "2023-24", "2022-23"];

const panField = (): ServiceField => ({
  key: "pan",
  label: "PAN",
  kind: "input",
  placeholder: "e.g. ABCDE1234F",
  parse: "pan",
  mask: "pan",
  format:
    "A 10-character PAN: 5 letters, then 4 digits, then 1 letter. Uppercase, no spaces. Example: ABCDE1234F.",
  validate: (v) =>
    PAN_REGEX.test(normalizePan(v))
      ? null
      : "Please enter a valid 10-character PAN (e.g. ABCDE1234F).",
});

const aadhaarField = (): ServiceField => ({
  key: "aadhaar",
  label: "Aadhaar Number",
  kind: "input",
  placeholder: "12-digit Aadhaar",
  parse: "aadhaar",
  mask: "aadhaar",
  format: "A 12-digit Aadhaar number, digits only. Example: 234523452345.",
  validate: (v) =>
    AADHAAR_REGEX.test(normalizeAadhaar(v))
      ? null
      : "Please enter a valid 12-digit Aadhaar number.",
});

const assessmentYearField = (): ServiceField => ({
  key: "assessmentYear",
  label: "Assessment Year",
  kind: "select",
  options: AY_OPTIONS,
  default: "2024-25",
});

const mobileField = (): ServiceField => ({
  key: "mobile",
  label: "Mobile Number",
  kind: "input",
  placeholder: "10-digit mobile",
  parse: "digits",
  format: "A 10-digit mobile number, digits only.",
  validate: (v) =>
    /^[6-9][0-9]{9}$/.test(v.replace(/\D/g, ""))
      ? null
      : "Please enter a valid 10-digit mobile number.",
});

const amountField = (key: string, label: string): ServiceField => ({
  key,
  label,
  kind: "input",
  placeholder: "Amount in ₹",
  parse: "digits",
  format: "An amount in rupees, digits only.",
  validate: (v) =>
    Number(v.replace(/[^\d]/g, "")) > 0
      ? null
      : "Please enter an amount greater than zero.",
});

const rupees = (n: number) => `\u20B9 ${n.toLocaleString("en-IN")}`;
const digits = (v: string) => v.replace(/\D/g, "");
const idFrom = (seed: string, prefix: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `${prefix}${(h % 9000000 + 1000000).toString()}`;
};

// --- the services ----------------------------------------------------------
const REFUNDS: Record<string, Omit<ServiceResult, "rows"> & { extra: ResultRow[] }> = {
  ABCDE1234F: {
    status: "success",
    headline: "Refund Issued",
    detail:
      "Your refund has been credited to your registered bank account (A/C ****4821).",
    extra: [
      { label: "Refund Amount", value: rupees(24500) },
      { label: "Refund Mode", value: "ECS / Direct Credit" },
      { label: "Reference No.", value: "REF2026IT0098421" },
      { label: "Status As On", value: "12 Aug 2026" },
    ],
  },
  AAAPZ9012K: {
    status: "warning",
    headline: "Refund Under Process",
    detail:
      "Your return has been processed and the refund is awaiting release by the refund banker.",
    extra: [
      { label: "Reference No.", value: "REF2026IT0100233" },
      { label: "Status As On", value: "20 Aug 2026" },
    ],
  },
};

export const SERVICES: ServiceDef[] = [
  {
    id: "refund_status",
    title: "Check Refund Status",
    description: "Check the status of your tax refund (demo).",
    icon: "💸",
    keywords: [
      "refund",
      "refund status",
      "refund ka status",
      "wapas",
      "vapas",
      "wapsi",
      "रिफंड",
      "रिफ़ंड",
      "रिटर्न स्टेटस",
      "वापसी",
    ],
    fields: [panField(), assessmentYearField()],
    submitLabel: "Continue",
    consequential: false,
    run: (v) => {
      const pan = normalizePan(v.pan);
      const base: ResultRow[] = [
        { label: "PAN", value: maskPan(pan) },
        { label: "Assessment Year", value: v.assessmentYear || "2024-25" },
      ];
      const known = REFUNDS[pan];
      if (known)
        return {
          status: known.status,
          headline: known.headline,
          detail: known.detail,
          rows: [...base, ...known.extra],
        };
      return {
        status: "error",
        headline: "No Refund Records Found",
        detail:
          "No refund record was found for this PAN and Assessment Year in our demo database.",
        rows: base,
      };
    },
  },
  {
    id: "link_aadhaar",
    title: "Link ID Numbers",
    description: "Link your PAN with Aadhaar (demo).",
    icon: "🔗",
    keywords: ["aadhaar", "aadhar", "adhaar", "adhar", "आधार", "link pan"],
    fields: [panField(), aadhaarField()],
    submitLabel: "Link Aadhaar",
    consequential: true,
    run: (v) => {
      const pan = normalizePan(v.pan);
      const aadhaar = normalizeAadhaar(v.aadhaar);
      const rows: ResultRow[] = [
        { label: "PAN", value: maskPan(pan) },
        { label: "Aadhaar", value: maskAadhaar(aadhaar) },
      ];
      if (pan === "ABCDE1234F")
        return {
          status: "success",
          headline: "PAN is Already Linked with Aadhaar",
          detail:
            "Your PAN is already linked to the given Aadhaar number. No further action is required.",
          rows,
        };
      if (aadhaar === "000000000000" || pan === "ZZZZZ0000Z")
        return {
          status: "error",
          headline: "Linking Failed — Details Do Not Match",
          detail:
            "The name/date of birth on your PAN and Aadhaar do not match in this demo scenario.",
          rows,
        };
      return {
        status: "success",
        headline: "Link Aadhaar Request Submitted",
        detail:
          "Your request to link PAN with Aadhaar has been accepted and is being processed.",
        rows: [
          ...rows,
          { label: "Request ID", value: idFrom(pan + aadhaar, "AADH2026LK") },
          { label: "Submitted On", value: "28 Aug 2026" },
        ],
      };
    },
  },
  {
    id: "e_pay_tax",
    title: "Pay Tax Online",
    description: "Pay taxes online and get a receipt (demo).",
    icon: "🧾",
    keywords: [
      "pay tax",
      "e-pay",
      "epay",
      "e pay tax",
      "challan",
      "tax payment",
      "pay my tax",
      "tax bharna",
      "tax jama",
      "कर भुगतान",
    ],
    fields: [panField(), assessmentYearField(), amountField("amount", "Tax Amount")],
    submitLabel: "Pay Now",
    consequential: true,
    run: (v) => {
      const pan = normalizePan(v.pan);
      const amt = Number(digits(v.amount));
      return {
        status: "success",
        headline: "Tax Payment Successful",
        detail:
          "Your tax payment has been received and a receipt (CIN) has been generated for this demo.",
        rows: [
          { label: "PAN", value: maskPan(pan) },
          { label: "Assessment Year", value: v.assessmentYear || "2024-25" },
          { label: "Amount Paid", value: rupees(amt) },
          { label: "Challan (CIN)", value: idFrom(pan + amt, "CIN2026") },
          { label: "Paid On", value: "28 Aug 2026" },
        ],
      };
    },
  },
  {
    id: "verify_pan",
    title: "Verify Tax ID",
    description: "Verify your PAN details and status (demo).",
    icon: "🪪",
    keywords: [
      "verify pan",
      "check pan",
      "pan status",
      "pan valid",
      "validate pan",
      "pan details",
      "pan verify",
      "पैन verify",
    ],
    fields: [
      panField(),
      {
        key: "fullName",
        label: "Full Name (as per PAN)",
        kind: "input",
        placeholder: "Full name",
        parse: "text",
        validate: (v) =>
          v.trim().length >= 2 ? null : "Please enter the full name as per PAN.",
      },
    ],
    submitLabel: "Verify PAN",
    consequential: false,
    run: (v) => {
      const pan = normalizePan(v.pan);
      return {
        status: "success",
        headline: "PAN is Valid and Active",
        detail:
          "The PAN provided exists in our demo database and is currently active.",
        rows: [
          { label: "PAN", value: maskPan(pan) },
          { label: "Name", value: v.fullName || "—" },
          { label: "Status", value: "Active" },
          { label: "Jurisdiction", value: "Ward 12(3), Mumbai" },
        ],
      };
    },
  },
  {
    id: "instant_epan",
    title: "Instant e-PAN",
    description: "Get a new PAN using Aadhaar (demo).",
    icon: "⚡",
    keywords: [
      "instant e-pan",
      "instant epan",
      "e-pan",
      "epan",
      "instant pan",
      "new pan",
      "naya pan",
      "apply pan",
      "get pan",
      "pan banwana",
    ],
    fields: [aadhaarField(), mobileField()],
    submitLabel: "Generate e-PAN",
    consequential: true,
    run: (v) => {
      const aadhaar = normalizeAadhaar(v.aadhaar);
      return {
        status: "success",
        headline: "e-PAN Generated Successfully",
        detail:
          "Your instant e-PAN has been generated using your Aadhaar in this demo.",
        rows: [
          { label: "Aadhaar", value: maskAadhaar(aadhaar) },
          { label: "Mobile", value: `••••••${digits(v.mobile).slice(-4)}` },
          { label: "New PAN", value: "FMEPP" + digits(aadhaar).slice(0, 4) + "Q" },
          { label: "Acknowledgement", value: idFrom(aadhaar, "EPAN2026") },
        ],
      };
    },
  },
  {
    id: "know_tan",
    title: "Check TAN Details",
    description: "Search the TAN of a deductor (demo).",
    icon: "🏢",
    keywords: ["tan", "know tan", "tan details", "deductor", "tan number"],
    fields: [
      {
        key: "tan",
        label: "TAN",
        kind: "input",
        placeholder: "e.g. MUMA12345B",
        parse: "text",
        format:
          "A 10-character TAN: 4 letters, 5 digits, 1 letter. Example: MUMA12345B.",
        validate: (v) =>
          TAN_REGEX.test(v.replace(/\s+/g, "").toUpperCase())
            ? null
            : "Please enter a valid 10-character TAN (e.g. MUMA12345B).",
      },
    ],
    submitLabel: "Search TAN",
    consequential: false,
    run: (v) => {
      const tan = v.tan.replace(/\s+/g, "").toUpperCase();
      return {
        status: "success",
        headline: "TAN Details Found",
        detail: "The following deductor is registered against this TAN in our demo database.",
        rows: [
          { label: "TAN", value: tan },
          { label: "Deductor Name", value: "ACME INDUSTRIES PVT LTD" },
          { label: "Category", value: "Company" },
          { label: "Address", value: "Andheri East, Mumbai - 400069" },
        ],
      };
    },
  },
  {
    id: "authenticate_notice",
    title: "Authenticate Document",
    description: "Verify a notice or order (demo).",
    icon: "📄",
    keywords: [
      "authenticate notice",
      "verify notice",
      "notice",
      "authenticate order",
      "din",
      "document number",
    ],
    fields: [
      panField(),
      {
        key: "documentNumber",
        label: "Document Number (DIN)",
        kind: "input",
        placeholder: "e.g. ITBA/AST/2026/123456",
        parse: "text",
        validate: (v) =>
          v.trim().length >= 6 ? null : "Please enter the document number (DIN).",
      },
    ],
    submitLabel: "Authenticate",
    consequential: false,
    run: (v) => {
      const pan = normalizePan(v.pan);
      return {
        status: "success",
        headline: "Document Authenticated",
        detail:
          "This document was issued by the relevant authority in this demo scenario.",
        rows: [
          { label: "PAN", value: maskPan(pan) },
          { label: "Document Number", value: v.documentNumber },
          { label: "Issued By", value: "Assessing Officer, Ward 12(3)" },
          { label: "Issued On", value: "05 Jul 2026" },
          { label: "Status", value: "Valid" },
        ],
      };
    },
  },
  {
    id: "tax_calculator",
    title: "Tax Calculator",
    description: "Estimate your tax liability (demo).",
    icon: "🧮",
    keywords: [
      "tax calculator",
      "calculate tax",
      "estimate tax",
      "compute tax",
      "kitna tax",
      "tax kitna",
      "calculate my tax",
      "tax nikalo",
    ],
    fields: [assessmentYearField(), amountField("income", "Total Income")],
    submitLabel: "Calculate Tax",
    consequential: false,
    run: (v) => {
      const income = Number(digits(v.income));
      const tax = estimateTax(income);
      const cess = Math.round(tax * 0.04);
      return {
        status: "success",
        headline: "Estimated Tax Liability",
        detail:
          "This is an indicative estimate for demonstration purposes.",
        rows: [
          { label: "Assessment Year", value: v.assessmentYear || "2024-25" },
          { label: "Total Income", value: rupees(income) },
          { label: "Income Tax", value: rupees(tax) },
          { label: "Health & Edu Cess (4%)", value: rupees(cess) },
          { label: "Total Payable", value: rupees(tax + cess) },
        ],
      };
    },
  },
];

function estimateTax(income: number): number {
  const slabs = [
    [300000, 0],
    [600000, 0.05],
    [900000, 0.1],
    [1200000, 0.15],
    [1500000, 0.2],
    [Infinity, 0.3],
  ] as const;
  let tax = 0;
  let last = 0;
  for (const [ceiling, rate] of slabs) {
    if (income > last) {
      const taxable = Math.min(income, ceiling) - last;
      tax += taxable * rate;
      last = ceiling;
    } else break;
  }
  return Math.round(tax);
}

// --- lookups ---------------------------------------------------------------
export const SERVICE_BY_ID: Record<string, ServiceDef> = Object.fromEntries(
  SERVICES.map((s) => [s.id, s])
);

/** Field key -> human label, across all services (for spoken prompts). */
export const FIELD_LABELS: Record<string, string> = (() => {
  const m: Record<string, string> = {
    assessment_year: "Assessment Year",
  };
  for (const s of SERVICES)
    for (const f of s.fields) if (!m[f.key]) m[f.key] = f.label;
  return m;
})();

export const formStateFor = (id: string) => `${id}_form`;

export function serviceByFormState(state: string): ServiceDef | undefined {
  return SERVICES.find((s) => formStateFor(s.id) === state);
}

// --- workflow generation ---------------------------------------------------
export function buildWorkflowFromService(def: ServiceDef): Workflow {
  const formState = formStateFor(def.id);
  const elements: Record<string, SemanticElement> = {
    services_link: {
      type: "link",
      label: "Services",
      dom: "#nav-services-link",
      state: "home",
    },
    [`${def.id}_link`]: {
      type: "link",
      label: def.title,
      dom: `#svc-${def.id}-link`,
      state: "services",
    },
  };

  for (const f of def.fields) {
    elements[`${def.id}_${f.key}`] = {
      type: f.kind,
      label: f.label,
      dom: `#fld-${def.id}-${f.key}`,
      state: formState,
      field: f.key,
      sessionKey: f.key,
      valueRef: `user.${f.key}`,
      options: f.options,
      format: f.format,
    };
  }

  elements[`${def.id}_submit`] = {
    type: "button",
    label: def.submitLabel,
    dom: `#svc-${def.id}-submit`,
    state: formState,
    consequential: def.consequential,
  };
  elements[`${def.id}_result`] = {
    type: "result",
    label: def.title,
    dom: "#service-result",
    state: "result",
  };

  return {
    workflow_id: def.id,
    entry_point: "demo_services",
    description: def.title,
    required_inputs: def.fields.map((f) => f.key),
    states: ["home", "services", formState, "result"],
    elements,
  };
}

import { detectLines } from "./findings.mjs";

function isCard(candidate) {
  const digits = candidate.replace(/[ -]/g, "");
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = digits.length - 1, double = false; i >= 0; i--, double = !double) {
    let value = Number(digits[i]);
    if (double) value *= 2;
    sum += value > 9 ? value - 9 : value;
  }
  return sum % 10 === 0;
}

const rules = [
  {
    ruleId: "email-address",
    pattern: /(?<![A-Za-z0-9.!#$%&'*+/=?^_`{|}~-])[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,63}(?![A-Za-z0-9_-])/g,
  },
  {
    ruleId: "phone-number",
    // Separated NANP numbers, optionally +1/001; area and exchange start at 2–9.
    pattern: /(?<![\w+.-])(?:(?:\+1|001)[ .-]?)?(?:\([2-9]\d{2}\)[ .-]?|[2-9]\d{2}[ .-])[2-9]\d{2}[ .-]\d{4}(?!\w|[.-]\d)/g,
  },
  {
    ruleId: "phone-number",
    // Explicit international prefix only; 8–15 digits including country code.
    pattern: /(?<![\w+.-])(?:\+|00)[1-9](?:[ .-]?\d)+(?!\w)/g,
    accept(candidate) {
      const number = candidate.replace(/^(?:\+|00)/, "");
      const digits = number.replace(/[ .-]/g, "");
      return digits.length >= 8 && digits.length <= 15 && !/^\d{4}-\d{2}-\d{2}$/.test(number);
    },
  },
  {
    ruleId: "payment-card",
    pattern: /(?<![\w-])\d(?:[ -]?\d){12,}(?!\w)/g,
    accept: isCard,
  },
  {
    ruleId: "us-ssn",
    pattern: /(?<![\w-])(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}(?![\w-])/g,
  },
];

/** Bounded shape checks, not identity verification or comprehensive global PII detection. */
export function detectPersonalData(content) {
  return detectLines(content, rules);
}

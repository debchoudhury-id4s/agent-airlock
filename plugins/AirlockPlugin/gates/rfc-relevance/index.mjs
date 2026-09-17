import { z } from "zod";
import { findingsSchema } from "../../runtime/policies.mjs";
import { isSupportedText } from "../../runtime/plain-text.mjs";
import defaultSnapshot from "./snapshot.json" with { type: "json" };

const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/);
const rfcSchema = z.object({
  id: z.string().regex(/^RFC[1-9][0-9]{3,4}$/),
  title: z.string().min(1).max(256),
  url: z.string().url().regex(/^https:\/\/www\.rfc-editor\.org\/rfc\/rfc[1-9][0-9]{3,4}\.html$/),
}).strict();
const topicSchema = z.object({
  id: identifier,
  title: z.string().min(1).max(128),
  keywords: z.array(z.string().trim().min(3).max(128)).min(1),
  rfcIds: z.array(z.string().regex(/^RFC[1-9][0-9]{3,4}$/)).min(1),
}).strict();
const snapshotSchema = z.object({
  id: identifier,
  version: identifier,
  source: z.literal("RFC Editor"),
  rfcs: z.array(rfcSchema).min(1),
  topics: z.array(topicSchema).min(1),
}).strict().superRefine((snapshot, context) => {
  const rfcIds = new Set(snapshot.rfcs.map(rfc => rfc.id));
  if (rfcIds.size !== snapshot.rfcs.length) {
    context.addIssue({ code: "custom", message: "RFC IDs must be unique." });
  }
  const topicIds = new Set(snapshot.topics.map(topic => topic.id));
  if (topicIds.size !== snapshot.topics.length) {
    context.addIssue({ code: "custom", message: "Topic IDs must be unique." });
  }
  for (const topic of snapshot.topics) {
    if (new Set(topic.keywords.map(keyword => keyword.toLowerCase())).size !== topic.keywords.length) {
      context.addIssue({ code: "custom", message: `Keywords for ${topic.id} must be unique.` });
    }
    if (topic.rfcIds.some(id => !rfcIds.has(id))) {
      context.addIssue({ code: "custom", message: `Topic ${topic.id} references an unknown RFC.` });
    }
  }
});

function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function parseSnapshot(snapshot) {
  try {
    return freeze(snapshotSchema.parse(snapshot));
  } catch {
    throw new Error("Invalid Airlock RFC relevance snapshot.");
  }
}

export const rfcSnapshot = parseSnapshot(defaultSnapshot);

/** Return snapshot-backed topic and RFC metadata for safe advisory display. */
export function recommendationsFor(findings, snapshot = rfcSnapshot) {
  const parsedSnapshot = parseSnapshot(snapshot);
  const parsedFindings = findingsSchema.parse(findings);
  const topics = new Map(parsedSnapshot.topics.map(topic => [topic.id, topic]));
  const rfcs = new Map(parsedSnapshot.rfcs.map(rfc => [rfc.id, rfc]));
  return parsedFindings.map(finding => {
    const topic = topics.get(finding.ruleId);
    if (!topic) throw new Error("Finding is not present in the RFC snapshot.");
    return {
      topic: topic.title,
      line: finding.line,
      rfcs: topic.rfcIds.map(id => rfcs.get(id)),
    };
  });
}

/** Read-only prompt check against a trusted, dated topic-to-RFC snapshot. */
export function createRfcRelevanceGate({ snapshot = rfcSnapshot } = {}) {
  const trustedSnapshot = parseSnapshot(snapshot);
  return Object.freeze({
    id: "rfc-relevance",
    failureReason: "rfc-relevance-check-failed",
    async evaluate(action) {
      if (action.tool !== "review_rfc_relevance") throw new Error("Expected the RFC relevance action.");
      const prompt = action.input.prompt;
      if (!isSupportedText(prompt)) throw new Error("Expected supported prompt text.");
      const lines = prompt.split(/\r?\n/);
      const findings = [];
      for (const topic of trustedSnapshot.topics) {
        const line = lines.findIndex(text => {
          const normalized = text.toLowerCase();
          return topic.keywords.some(keyword => normalized.includes(keyword.toLowerCase()));
        });
        if (line >= 0) findings.push({ ruleId: topic.id, line: line + 1 });
      }
      const parsed = findingsSchema.parse(findings);
      return {
        decision: parsed.length ? "report" : "allow",
        reason: parsed.length ? "relevant-rfcs-found" : "no-rfc-topic-match",
        findings: parsed,
      };
    },
  });
}

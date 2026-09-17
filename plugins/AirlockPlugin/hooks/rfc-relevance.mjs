import { pathToFileURL } from "node:url";
import { createRfcRelevanceGate, recommendationsFor, rfcSnapshot } from "../gates/rfc-relevance/index.mjs";
import { createPolicyEvaluator } from "../runtime/policies.mjs";
import policy from "../policies/rfc-relevance.json" with { type: "json" };

function emit(write, value) {
  write(`${JSON.stringify(value)}\n`);
}

function formatRecommendation(recommendation) {
  const references = recommendation.rfcs
    .map(rfc => `${rfc.id} (${rfc.url})`)
    .join(", ");
  return `${recommendation.topic}: ${references}`;
}

export async function runRfcRelevanceHook({
  prompt,
  policyConfig = policy,
  snapshot = rfcSnapshot,
  write = text => process.stdout.write(text),
} = {}) {
  const gate = createRfcRelevanceGate({ snapshot });
  const evaluate = createPolicyEvaluator({ policy: policyConfig, gates: [gate] });
  const result = await evaluate({
    tool: "review_rfc_relevance",
    target: "submitted-prompt",
    input: { prompt },
  });
  if (result.decision === "report") {
    const recommendations = recommendationsFor(result.findings, snapshot);
    emit(write, {
      type: "progress",
      message: `Relevant RFCs found in local snapshot ${snapshot.version}. Review before designing: ${recommendations.map(formatRecommendation).join("; ")}`,
    });
  }
  emit(write, {});
  return result;
}

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return JSON.parse(input);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    const input = await readStdin();
    await runRfcRelevanceHook({ prompt: input.prompt });
  } catch {
    emit(text => process.stdout.write(text), {
      type: "progress",
      message: "RFC relevance | unavailable: rfc-relevance-hook-failed",
    });
    emit(text => process.stdout.write(text), {});
  }
}

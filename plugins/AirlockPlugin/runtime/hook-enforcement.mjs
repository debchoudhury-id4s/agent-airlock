// Brokered Airlock tools remain responsible for their own gate and receipt flow.
const guardedAirlockTools = new Set([
  "check_intent",
  "publish_draft",
  "publish_approved_draft",
  "review_dependency_change",
  "select_model",
  "trending_cost",
]);
const shellTools = /(?:^|[-_.])(bash|powershell)(?:$|[-_.])/i;
const onlineServices = /(?:^|[-_.])(calendar|github|icm|kusto|mail|teams|workiq)(?:$|[-_.])/i;
const mutation = /(?:^|[-_.])(accept|acknowledge|action|add|cancel|command|create|decline|delete|forward|ingest|merge|mitigate|post|publish|reactivate|remove|reply|resolve|send|transfer|update)/i;

function deny(reason) {
  return {
    permissionDecision: "deny",
    permissionDecisionReason: `Blocked by Airlock policy: ${reason}`,
  };
}

function shellText(args) {
  if (typeof args === "string") return args;
  if (!args || typeof args !== "object") return "";
  return ["command", "script", "cmd", "input"]
    .map(key => args[key])
    .find(value => typeof value === "string") ?? "";
}

function airlockToolName(toolName) {
  const normalized = toolName.toLowerCase();
  return [...guardedAirlockTools].find(name => normalized.endsWith(name));
}

export function describePotentialOnlineWrite(toolName, toolArgs) {
  if (typeof toolName !== "string" || !toolName) {
    return { blocked: true, reason: "invalid-tool-request" };
  }
  if (airlockToolName(toolName)) return null;
  if (shellTools.test(toolName)) {
    const command = shellText(toolArgs);
    return command ? { prompt: command } : { blocked: true, reason: "uninspectable-shell-command" };
  }
  if (onlineServices.test(toolName) && mutation.test(toolName)) {
    return { blocked: true, reason: "direct-online-write" };
  }
  return null;
}

export async function decidePreToolUse({ event, mission, check }) {
  if (!mission || mission.sessionId !== event.sessionId) return deny("mission-state-missing");
  if (mission.decision !== "allow") return deny(mission.reason);

  const candidate = describePotentialOnlineWrite(event.toolName, event.toolArgs);
  // An empty response leaves the final decision to Copilot's normal permissions.
  if (!candidate) return {};
  if (candidate.blocked) return deny(candidate.reason);

  const result = await check({ prompt: candidate.prompt });
  if (result.status === "cleared") return {};
  if (result.decision === "ask-first") {
    return {
      permissionDecision: "ask",
      permissionDecisionReason: `Airlock approval required: ${result.reason}`,
    };
  }
  return deny(result.reason ?? "tool-policy-failed");
}

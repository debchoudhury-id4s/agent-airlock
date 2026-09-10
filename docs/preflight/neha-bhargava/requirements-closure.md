# 2026-09-10

## Problems
1. **Repeated tasks keep using an LLM.** Teams repeatedly ask an agent to perform the same deterministic steps, such as formatting files, collecting repository status, or generating a standard report. Each run spends model tokens reasoning through an already-known process, may produce different results, and cannot be easily replayed without the agent.
   *Extends the existing preference for repository scripts: when no script exists yet, the agent should recognize that the task is repetitive and deterministic rather than continuing to use an LLM for every run.*
2. **A local fix can break a security standard.** A security team designs a change, implements it, or reviews a pull request against only the immediate requirement. The change can close one issue while introducing another because no step verifies the applicable industry standards, protocol guidance, or RFC requirements.
   *Security review cannot be a final, generic checklist: the relevant standard must inform the design and implementation before the pull request is ready.*
3. **Sensitive material can leave through normal work.** Any team can accidentally place credentials, tokens, personal data, or internal-only content in source changes, logs, test fixtures, commit messages, or pull-request descriptions. The agent may then expose the material while completing an otherwise routine task.
   *This is an organization-wide data-boundary problem, not a security-team-only review concern.*
4. **A dependency change can import known risk.** A pull request can introduce or update a dependency with known security advisories, an unsupported version, or unclear provenance. Tests may still pass while the change makes the product less secure.
   *The dependency must be evaluated as part of the change, rather than treated as an implementation detail outside the security review.*

## Capabilities
1. **Turn repetitive work into reusable PowerShell scripts.** When a task is deterministic and likely to be repeated, the agent creates or recommends a checked-in PowerShell script with explicit inputs, outputs, validation, and clear failure behavior. Future runs use the script directly and involve the LLM only when judgment, interpretation, or a change to the workflow is required.
   *Reduces model usage, makes results consistent and reviewable, and gives people a command they can run without an agent.*
2. **Apply security standards and RFCs throughout the change.** For security-sensitive design exploration, implementation, and pull-request review, the agent identifies the relevant industry standards and RFCs, checks the proposed behavior against them, and records the guidance used and any deliberate deviation. A change does not pass review merely because it fixes the reported issue; it must not introduce a new standards or protocol violation.
   *Makes external security guidance a traceable constraint across the whole workflow, rather than an optional after-the-fact review.*
3. **Security gate for secrets and sensitive data.** Before content leaves the local environment, inspect source edits, logs, test fixtures, commit messages, pull-request text, and outbound actions for credentials, tokens, personal data, and internal-only material. Block confirmed secrets, pause on sensitive content, and explain the matched rule and safe remediation. Apply the same gate to every team.
   *Protects the data boundary at the point it can be crossed, without relying on each team to remember a separate review step.*
4. **Dependency and advisory gate.** When a change adds or updates a dependency, identify the resolved version and check its security advisories, support status, and provenance. Block known unacceptable risk and pause when an advisory requires a documented mitigation or exception before the pull request can proceed.
   *Makes a dependency's security posture an explicit, reviewable part of the change.*

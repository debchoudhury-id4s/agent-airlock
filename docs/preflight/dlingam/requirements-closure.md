# 2026-09-10

## Problems
1. **Every new session starts from zero.** A long-running project spans many days, but each new agent session repeats repository searches, document reads, experiments, and decisions that an earlier session already completed. The repeated research adds latency and cost, and two sessions can reach different conclusions from the same evidence.
   *The useful unit is not the old transcript. It is reusable knowledge: what was learned, where it came from, when it was verified, and which task it applies to.*
2. **Agent context is trapped in one product or prompt.** Useful findings may live in a chat history, a vendor-specific memory feature, or a growing prompt. Teams cannot plug in an existing local or shared store, move context between agent platforms, or apply their own retention and access rules.
   *The project should reuse storage and retrieval systems through adapters rather than invent another required database.*
3. **Sessions doing the same work cannot converge.** Two agents may investigate the same bug, dependency, or design in parallel without knowing it. Their evidence and partial results remain isolated, so work is duplicated and conflicting conclusions are discovered late.
   *Sharing must preserve task boundaries, sources, ownership, and disagreements; silently combining transcripts would create more risk than reuse.*
4. **Token budgets are spent on avoidable work.** Agents receive repeated instructions and redundant context, make one tool or API call per item, ask the model to perform deterministic computation, and serialize data in verbose formats. Unstable prompt prefixes also prevent available prompt caches from being reused.
   *Many savings come from simple orchestration rules, existing scripts, batching, caching, retrieval limits, and compact representations rather than a new model.*
5. **Token-saving guidance is optional and unmeasured.** Recommendations such as “keep prompts short” live in prompts or team folklore. Different agents apply them differently, nobody can show which optimization was used, and aggressive trimming can remove evidence needed for a correct or safe decision.
   *Efficiency must be a reviewable policy with a quality boundary, not an instruction to use fewer tokens at any cost.*

## Capabilities
1. **Reuse context before repeating research.** Before work starts, derive a stable task signature from the mission, repository, files, issue, and requested outcome. Query approved external context sources for matching prior findings and show the agent only the relevant knowledge, evidence, freshness, and provenance. Perform new research only for missing, stale, or conflicting facts.
   *Makes “reuse, do not reinvent” the default while keeping retrieved context inspectable.*
2. **Plug-and-play knowledge graph adapters.** Define a small provider contract for searching, reading, and writing entities, relationships, claims, sources, timestamps, confidence, and access labels. Support local-only and shared providers, including existing graph, vector, document, or database systems, without making one storage product mandatory.
   *Airlock governs which provider and data boundary a mission may use; it does not reinvent the storage engine.*
3. **Provenance-aware knowledge write-back.** At the end of a run, save reusable findings, decisions, source links, produced artifacts, and invalidation conditions instead of copying the full transcript by default. Every claim records which session produced it and which evidence supports it. Retention and sharing follow the mission's approved rules.
   *Future agents receive durable knowledge without treating an earlier model response as unquestioned truth.*
4. **Detect and connect overlapping work.** Compare active and recent task signatures. When two sessions substantially overlap, show the common scope and allow them to reuse published findings, subscribe to updates, divide remaining work, or merge results. Preserve conflicting claims side by side until evidence or a person resolves them.
   *Prevents duplicate effort without allowing one session to silently widen or overwrite another session's contract.*
5. **Token-efficiency rules outside the prompt.** Keep deterministic optimization policy in a versioned rule file: remove duplicate context, retrieve only task-relevant graph neighborhoods, use stable cacheable prompt prefixes, batch independent tool and API calls, prefer existing scripts for deterministic work, and use compact structured representations when the receiving tool supports them.
   *The same policy can be reused by different agents and changed without rewriting every prompt.*
6. **A context and compute plan before takeoff.** Add Context, Reuse, Compute, and Budget to the agent contract. Show which prior knowledge will be loaded, which work will use tools or scripts instead of model reasoning, which calls will be batched, what may be shared, and the maximum context or token budget. Flag a plan that ignores available reusable work or exceeds its budget before the run starts.
   *Extends Airlock's preflight model from permissions alone to an explicit, reviewable efficiency plan.*
7. **Quality-preserving fallback.** Treat stale, low-confidence, inaccessible, or contradictory graph data as a reason to verify or research, not as permission to guess. Token limits cannot remove required safety rules, evidence, approvals, or task constraints. If the budget is insufficient, pause with the exact tradeoff instead of silently degrading the answer.
   *Optimization remains subordinate to correctness, security, and the approved mission.*
8. **Reusable-work and token activity summary.** After the run, report prior findings reused, research avoided, new knowledge published, overlapping sessions connected, cache hits, calls batched, deterministic work moved to tools, tokens used, and the rule behind each choice. Include enough information to compare the optimized run with a baseline.
   *Turns reuse and token reduction into measurable outcomes rather than claims.*

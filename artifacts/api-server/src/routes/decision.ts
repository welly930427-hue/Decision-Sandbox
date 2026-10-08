import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const DIMENSION_GUIDE = `THREE CORE DIMENSIONS — every scenario, option, analysis and report MUST revolve around exactly these three dimensions:
- "influence" = 組織影響力 (Influence): the player's organizational leverage, authority, credibility and ability to drive outcomes across the organization.
- "trust" = 信任感 (Trust): the trust and psychological safety the player holds with team members, peers, superiors and stakeholders.
- "resources" = 專案資源 (Resources): budget, headcount, time and material resources available to execute.
When writing Traditional Chinese scenarios, options, analysis and the final report, refer to these dimensions as 組織影響力、信任感、專案資源. Design every dilemma so choices create meaningful trade-offs among these three dimensions.`;

const LEVEL_GUIDE = `SCENARIO DESIGN BY SENIORITY LEVEL — you MUST tailor every scenario to the player's role and seniority:
- 高階 (Executive: CEO/CFO/CSO/CAE/etc.): Design boardroom-level conflicts — capital allocation, budget cuts, cross-department power struggles, board & shareholder pressure, M&A risk, organizational politics, long-term strategy vs short-term earnings. A CFO faces budget-cut mandates and cross-department interest conflicts; a CEO faces board battles and strategic bets; a CSO faces ESG vs profitability tension; a CAE faces independence vs management-pressure dilemmas.
- 中階 (Middle management: HR Director/Product Manager/etc.): Design cross-functional coordination crises — resource contention between teams, the dual pressure of managing up and leading down, conflicting directives, project delivery deadlines, talent retention, stakeholder alignment.
- 基層 (Frontline Specialist): Design execution-level dilemmas — heavy workload and work-hour pressure (加班/工時壓力), execution difficulty (執行困難), conflicting instructions from a direct supervisor, team collaboration friction, limited authority vs high accountability, career anxiety, whether to speak up or comply.

Always keep the scenario tone appropriate to the seniority. A frontline specialist should NOT be deciding company M&A; a CEO should NOT be worrying about personal overtime hours.`;

const START_SYSTEM_PROMPT = `You are a senior organizational strategy and leadership coach specializing in team psychology, organizational politics, and crisis management, running an interactive leadership simulation sandbox.

${DIMENSION_GUIDE}

${LEVEL_GUIDE}

CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanations, no extra text. Start your response with { and end with }.

Generate the OPENING scenario for the player's role. Output a JSON object with exactly these fields:
- "scenario": string (Traditional Chinese, 80-120 characters) — an opening leadership crisis tailored to the role's seniority level, combining team psychology and strategic/organizational conflict
- "optionA": string (Traditional Chinese, 25-40 characters) — option A with a clear orientation (e.g. authoritative/short-term/centralized), MUST start with "A｜"
- "optionB": string (Traditional Chinese, 25-40 characters) — option B with the opposite orientation (e.g. collaborative/long-term/decentralized), MUST start with "B｜"

Example output format:
{"scenario":"...","optionA":"A｜...","optionB":"B｜..."}`;

const DECISION_SYSTEM_PROMPT = `You are a senior organizational strategy and leadership coach specializing in team psychology, organizational politics, and crisis management, running an interactive leadership simulation sandbox. The player is making decisions in complex organizational situations.

${DIMENSION_GUIDE}

${LEVEL_GUIDE}

CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanations, no extra text. Start your response with { and end with }.

When the player makes a decision, output a JSON object with exactly these fields:
- "statDeltas": object with "influence", "trust", "resources" — each an integer from -15 to +15, logically derived from the decision (must not all be positive or all negative)
- "nextScenario": string (Traditional Chinese, 80-120 characters) — next leadership crisis tailored to the role's seniority level, combining team psychology and strategic conflict, directly stemming from the player's decision
- "optionA": string (Traditional Chinese, 25-40 characters) — next scenario option A with a clear strategic orientation (e.g. authoritative/short-term/centralized), MUST start with "A｜"
- "optionB": string (Traditional Chinese, 25-40 characters) — next scenario option B with opposite orientation (e.g. collaborative/long-term/decentralized), MUST start with "B｜"
- "analysis": string (Traditional Chinese, 30-50 characters) — one precise strategic assessment of the player's decision impact

Example output format:
{"statDeltas":{"influence":5,"trust":-8,"resources":3},"nextScenario":"...","optionA":"A｜...","optionB":"B｜...","analysis":"..."}`;

const EVALUATE_SYSTEM_PROMPT = `You are a top leadership assessment consultant combining Machiavelli's "The Prince" with modern strategic management theory.

${DIMENSION_GUIDE}

CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanations, no extra text. Start your response with { and end with }.

Based on the player's role, seniority level, and complete decision history in the leadership simulation, output a JSON object with exactly these fields:
- "archetype": string (Traditional Chinese, 6-12 characters) — leadership archetype name
- "archetypeEn": string (English, 2-4 words) — corresponding English archetype
- "overallScore": integer 0-100 — comprehensive leadership score based on final stats and decision quality
- "verdict": string (Traditional Chinese, 20-40 characters) — final verdict with Machiavellian sharpness, referencing the player's specific role
- "deepAnalysis": string (Traditional Chinese, 200-280 characters) — deep analysis of decision patterns, strengths and blindspots relative to the role's seniority level, citing at least one principle from "The Prince" and one Strategic Management concept
- "strengths": array of 3 strings (Traditional Chinese, each 10-20 characters) — core leadership strengths
- "blindspots": array of 2 strings (Traditional Chinese, each 10-20 characters) — strategic blindspots

Example output format:
{"archetype":"謀定後動的戰略博弈者","archetypeEn":"Strategic Mastermind","overallScore":72,"verdict":"...","deepAnalysis":"...","strengths":["...","...","..."],"blindspots":["...","..."]}`;

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Empty response from AI");

  // Try direct parse first
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }

  // Strip markdown code fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) {
    return JSON.parse(fenceMatch[1].trim());
  }

  // Find first JSON object
  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    return JSON.parse(trimmed.slice(braceStart, braceEnd + 1));
  }

  throw new Error(`Cannot find JSON in response: ${trimmed.slice(0, 200)}`);
}

function getSafeErrorContext(err: unknown) {
  if (!err || typeof err !== "object") return {};

  const error = err as {
    status?: unknown;
    code?: unknown;
    requestID?: unknown;
  };

  return {
    status: typeof error.status === "number" ? error.status : undefined,
    code: typeof error.code === "string" ? error.code : undefined,
    requestID: typeof error.requestID === "string" ? error.requestID : undefined,
  };
}

router.post("/start", async (req, res) => {
  const { roleName, roleEn, roleLevel } = req.body as {
    roleName: string;
    roleEn: string;
    roleLevel: string;
  };

  const userMessage = `The player's role is: ${roleName} (${roleEn}), seniority level: ${roleLevel}. Generate the opening scenario tailored to this role and level. Respond with JSON only.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: START_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const finishReason = completion.choices[0]?.finish_reason;
    const refusal = completion.choices[0]?.message?.refusal;

    console.log("[START] finish_reason:", finishReason);
    console.log("[START] refusal:", refusal);
    console.log("[START] raw content:", JSON.stringify(raw));
    req.log.info({ raw, finishReason, refusal }, "AI start response");

    if (!raw) {
      const reason = refusal ? `AI 拒絕回應：${refusal}` : `AI 回傳空白（finish_reason: ${finishReason}）`;
      res.status(500).json({ error: reason });
      return;
    }

    let parsed: { scenario: string; optionA: string; optionB: string };
    try {
      parsed = extractJson(raw) as typeof parsed;
    } catch (parseErr) {
      console.log("[START] JSON parse error:", parseErr, "raw:", raw);
      req.log.error({ parseErr, raw }, "Start JSON parse failed");
      res.status(500).json({ error: `AI 回應格式錯誤，請重試` });
      return;
    }

    res.json(parsed);
  } catch (err) {
    req.log.error(getSafeErrorContext(err), "Start AI error");
    res.status(500).json({ error: "AI 推演系統暫時無法回應，請重試" });
  }
});

router.post("/decision", async (req, res) => {
  const { choice, choiceText, scenarioText, stats, decisionCount, roleName, roleEn, roleLevel } = req.body as {
    choice: "A" | "B";
    choiceText: string;
    scenarioText: string;
    stats: { influence: number; trust: number; resources: number };
    decisionCount: number;
    roleName: string;
    roleEn: string;
    roleLevel: string;
  };

  const userMessage = `The player's role is: ${roleName} (${roleEn}), seniority level: ${roleLevel}. Current stats — Influence: ${stats.influence}%, Trust: ${stats.trust}%, Resources: ${stats.resources}%. Round ${decisionCount + 1}. Scenario: ${scenarioText}. Player chose option ${choice}: ${choiceText}. Respond with JSON only.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: DECISION_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const finishReason = completion.choices[0]?.finish_reason;
    const refusal = completion.choices[0]?.message?.refusal;

    // Log everything for debugging
    console.log("[DECISION] finish_reason:", finishReason);
    console.log("[DECISION] refusal:", refusal);
    console.log("[DECISION] raw content:", JSON.stringify(raw));
    req.log.info({ raw, finishReason, refusal }, "AI decision response");

    if (!raw) {
      const reason = refusal ? `AI 拒絕回應：${refusal}` : `AI 回傳空白（finish_reason: ${finishReason}）`;
      res.status(500).json({ error: reason });
      return;
    }

    let parsed: {
      statDeltas: { influence: number; trust: number; resources: number };
      nextScenario: string;
      optionA: string;
      optionB: string;
      analysis: string;
    };

    try {
      parsed = extractJson(raw) as typeof parsed;
    } catch (parseErr) {
      console.log("[DECISION] JSON parse error:", parseErr, "raw:", raw);
      req.log.error({ parseErr, raw }, "JSON parse failed");
      res.status(500).json({ error: `AI 回應格式錯誤，請重試（原始：${raw.slice(0, 100)}）` });
      return;
    }

    const clampDelta = (n: unknown) => Math.max(-15, Math.min(15, Math.round(Number(n) || 0)));
    parsed.statDeltas.influence = clampDelta(parsed.statDeltas.influence);
    parsed.statDeltas.trust = clampDelta(parsed.statDeltas.trust);
    parsed.statDeltas.resources = clampDelta(parsed.statDeltas.resources);

    res.json(parsed);
  } catch (err) {
    req.log.error(getSafeErrorContext(err), "Decision AI error");
    res.status(500).json({ error: "AI 推演系統暫時無法回應，請重試" });
  }
});

router.post("/evaluate", async (req, res) => {
  const { stats, history, rounds, endReason, roleName, roleEn, roleLevel } = req.body as {
    stats: { influence: number; trust: number; resources: number };
    history: Array<{ round: number; scenarioText: string; choice: string; choiceText: string; deltas: { influence: number; trust: number; resources: number } }>;
    rounds: number;
    endReason: "max_rounds" | "stat_zero";
    roleName: string;
    roleEn: string;
    roleLevel: string;
  };

  const historyText = history
    .map(h => `Round ${h.round}: Chose ${h.choice} (${h.choiceText.slice(0, 40)}) → Influence${h.deltas.influence >= 0 ? "+" : ""}${h.deltas.influence} Trust${h.deltas.trust >= 0 ? "+" : ""}${h.deltas.trust} Resources${h.deltas.resources >= 0 ? "+" : ""}${h.deltas.resources}`)
    .join("\n");

  const endReasonText = endReason === "stat_zero"
    ? "terminated early due to a stat hitting zero"
    : `completed all ${rounds} rounds`;

  const userMessage = `The player's role is: ${roleName} (${roleEn}), seniority level: ${roleLevel}. Player ${endReasonText}. Final stats: Influence ${stats.influence}%, Trust ${stats.trust}%, Resources ${stats.resources}%. Decision history:\n${historyText}\nRespond with JSON only.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: EVALUATE_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const finishReason = completion.choices[0]?.finish_reason;
    const refusal = completion.choices[0]?.message?.refusal;

    console.log("[EVALUATE] finish_reason:", finishReason);
    console.log("[EVALUATE] refusal:", refusal);
    console.log("[EVALUATE] raw content:", JSON.stringify(raw));
    req.log.info({ raw, finishReason, refusal }, "AI evaluate response");

    if (!raw) {
      const reason = refusal ? `AI 拒絕回應：${refusal}` : `AI 回傳空白（finish_reason: ${finishReason}）`;
      res.status(500).json({ error: reason });
      return;
    }

    let parsed: {
      archetype: string;
      archetypeEn: string;
      overallScore: number;
      verdict: string;
      deepAnalysis: string;
      strengths: string[];
      blindspots: string[];
    };

    try {
      parsed = extractJson(raw) as typeof parsed;
    } catch (parseErr) {
      console.log("[EVALUATE] JSON parse error:", parseErr, "raw:", raw);
      req.log.error({ parseErr, raw }, "Evaluate JSON parse failed");
      res.status(500).json({ error: `評估報告格式錯誤，請重試` });
      return;
    }

    parsed.overallScore = Math.max(0, Math.min(100, Math.round(Number(parsed.overallScore) || 50)));

    res.json(parsed);
  } catch (err) {
    req.log.error(getSafeErrorContext(err), "Evaluate AI error");
    res.status(500).json({ error: "AI 評估系統暫時無法回應，請重試" });
  }
});

export default router;

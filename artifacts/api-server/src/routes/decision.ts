import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const DECISION_SYSTEM_PROMPT = `You are a senior organizational strategy and leadership coach specializing in team psychology, organizational politics, and crisis management.

You are running an interactive leadership simulation sandbox. The player is a senior executive making decisions in complex organizational situations.

CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanations, no extra text. Start your response with { and end with }.

When the player makes a decision, output a JSON object with exactly these fields:
- "statDeltas": object with "perimeter", "morale", "resources" — each an integer from -15 to +15, logically derived from the decision (must not all be positive or all negative)
- "nextScenario": string (Traditional Chinese, 80-120 characters) — next leadership crisis combining team psychology and strategic conflict, directly stemming from the player's decision
- "optionA": string (Traditional Chinese, 25-40 characters) — next scenario option A with a clear strategic orientation (e.g. authoritative/short-term/centralized)
- "optionB": string (Traditional Chinese, 25-40 characters) — next scenario option B with opposite orientation (e.g. collaborative/long-term/decentralized)
- "analysis": string (Traditional Chinese, 30-50 characters) — one precise strategic assessment of the player's decision impact

Example output format:
{"statDeltas":{"perimeter":5,"morale":-8,"resources":3},"nextScenario":"...","optionA":"A｜...","optionB":"B｜...","analysis":"..."}`;

const EVALUATE_SYSTEM_PROMPT = `You are a top leadership assessment consultant combining Machiavelli's "The Prince" with modern strategic management theory.

CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanations, no extra text. Start your response with { and end with }.

Based on the player's complete decision history in the leadership simulation, output a JSON object with exactly these fields:
- "archetype": string (Traditional Chinese, 6-12 characters) — leadership archetype name
- "archetypeEn": string (English, 2-4 words) — corresponding English archetype
- "overallScore": integer 0-100 — comprehensive leadership score based on final stats and decision quality
- "verdict": string (Traditional Chinese, 20-40 characters) — final verdict with Machiavellian sharpness
- "deepAnalysis": string (Traditional Chinese, 200-280 characters) — deep analysis of decision patterns, strengths and blindspots, citing at least one principle from "The Prince" and one Strategic Management concept
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

router.post("/decision", async (req, res) => {
  const { choice, choiceText, scenarioText, stats, decisionCount } = req.body as {
    choice: "A" | "B";
    choiceText: string;
    scenarioText: string;
    stats: { perimeter: number; morale: number; resources: number };
    decisionCount: number;
  };

  const userMessage = `Current stats — Perimeter: ${stats.perimeter}%, Morale: ${stats.morale}%, Resources: ${stats.resources}%. Round ${decisionCount + 1}. Scenario: ${scenarioText}. Player chose option ${choice}: ${choiceText}. Respond with JSON only.`;

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
      statDeltas: { perimeter: number; morale: number; resources: number };
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
    parsed.statDeltas.perimeter = clampDelta(parsed.statDeltas.perimeter);
    parsed.statDeltas.morale = clampDelta(parsed.statDeltas.morale);
    parsed.statDeltas.resources = clampDelta(parsed.statDeltas.resources);

    res.json(parsed);
  } catch (err) {
    console.log("[DECISION] Unexpected error:", err);
    req.log.error({ err }, "Decision AI error");
    res.status(500).json({ error: "AI 推演系統暫時無法回應，請重試" });
  }
});

router.post("/evaluate", async (req, res) => {
  const { stats, history, rounds, endReason } = req.body as {
    stats: { perimeter: number; morale: number; resources: number };
    history: Array<{ round: number; scenarioText: string; choice: string; choiceText: string; deltas: { perimeter: number; morale: number; resources: number } }>;
    rounds: number;
    endReason: "max_rounds" | "stat_zero";
  };

  const historyText = history
    .map(h => `Round ${h.round}: Chose ${h.choice} (${h.choiceText.slice(0, 40)}) → Perimeter${h.deltas.perimeter >= 0 ? "+" : ""}${h.deltas.perimeter} Morale${h.deltas.morale >= 0 ? "+" : ""}${h.deltas.morale} Resources${h.deltas.resources >= 0 ? "+" : ""}${h.deltas.resources}`)
    .join("\n");

  const endReasonText = endReason === "stat_zero"
    ? "terminated early due to a stat hitting zero"
    : `completed all ${rounds} rounds`;

  const userMessage = `Player ${endReasonText}. Final stats: Perimeter ${stats.perimeter}%, Morale ${stats.morale}%, Resources ${stats.resources}%. Decision history:\n${historyText}\nRespond with JSON only.`;

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
    console.log("[EVALUATE] Unexpected error:", err);
    req.log.error({ err }, "Evaluate AI error");
    res.status(500).json({ error: "AI 評估系統暫時無法回應，請重試" });
  }
});

export default router;

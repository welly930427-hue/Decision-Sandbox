import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const DECISION_SYSTEM_PROMPT = `你是一位高階組織戰略與領導力導師，專精於團隊心理學、組織政治學與危機管理。

你負責主持一個互動式領導力推演沙盤模擬器。玩家扮演一位高階主管，需要在複雜的組織局勢中做出決策。

每當玩家做出決策後，你必須輸出一個 JSON 物件，包含以下欄位：

1. statDeltas：根據玩家的當前數據與決策，計算三項指標的合理增減幅度。每項必須是 -15 到 +15 之間的整數，需要有邏輯性，不能全部正向或全部負向。
2. nextScenario：下一個突發領導力考驗情境，繁體中文，80-120字。必須融合團隊心理學與策管衝突，直接呼應玩家剛才決策的後果，帶有壓力感，避免重複之前情境主題。
3. optionA：下一個情境的選項A，繁體中文，25-40字，帶有明確策略取向（例如強硬/集權/短期導向）。
4. optionB：下一個情境的選項B，繁體中文，25-40字，帶有相反策略取向（例如懷柔/分權/長期導向）。
5. analysis：一句精準的戰略分析，繁體中文，30-50字，評估玩家剛才決策對組織局勢的影響。

你的回應必須是純粹的 JSON，不得有任何 markdown 格式、代碼塊、說明文字。格式如下：
{"statDeltas":{"perimeter":0,"morale":0,"resources":0},"nextScenario":"...","optionA":"...","optionB":"...","analysis":"..."}`;

const EVALUATE_SYSTEM_PROMPT = `你是一位結合馬基維利《君王論》與現代策略管理理論的頂尖領導力評估顧問。

你的任務是根據玩家在領導力推演沙盤中的完整決策歷程，給出一份深刻的結算評估報告。

評估框架必須融合：
- 《君王論》的核心法則（獅子的力量與狐狸的智慧、恩威並施的時機、命運女神與德行的博弈）
- 策略管理理論（競爭優勢、資源基礎觀點、利害關係人管理、動態能力理論）
- 組織心理學（權力距離、心理安全感、領導風格的情境適配）

你必須輸出一個 JSON 物件，包含以下欄位：
1. archetype：領導者原型名稱，繁體中文，6-12字（例如：「謀定後動的戰略博弈者」、「剛愎自用的孤獨君主」）。
2. archetypeEn：對應的英文原型名稱，2-4個英文單字（例如：Strategic Mastermind、Solitary Sovereign）。
3. overallScore：綜合領導力評分，0-100的整數，根據最終三項指標與決策質量綜合判斷。
4. verdict：一句最終裁決，繁體中文，20-40字，帶有《君王論》式的犀利洞見。
5. deepAnalysis：深度點評，繁體中文，200-280字，分析玩家的決策模式、優勢與盲點，引用至少一個《君王論》觀點和一個策略管理概念。
6. strengths：玩家的三個核心優勢，JSON陣列，每項10-20字的繁體中文字串。
7. blindspots：玩家的兩個戰略盲點，JSON陣列，每項10-20字的繁體中文字串。

你的回應必須是純粹的 JSON，不得有任何 markdown 格式、代碼塊、說明文字。`;

function extractJson(raw: string): string {
  const cleaned = raw.trim();
  if (cleaned.startsWith("{")) return cleaned;
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  if (braceMatch?.[0]) return braceMatch[0];
  throw new Error("No JSON found in AI response");
}

router.post("/decision", async (req, res) => {
  const { choice, choiceText, scenarioText, stats, decisionCount } = req.body as {
    choice: "A" | "B";
    choiceText: string;
    scenarioText: string;
    stats: { perimeter: number; morale: number; resources: number };
    decisionCount: number;
  };

  const userMessage = `當前局勢數據：權力邊界 ${stats.perimeter}%，團隊士氣 ${stats.morale}%，專案資源 ${stats.resources}%。決策輪次：第 ${decisionCount + 1} 輪。剛才的情境：${scenarioText}。玩家選擇了方案 ${choice}：${choiceText}。請輸出 JSON。`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: DECISION_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    req.log.info({ raw }, "AI decision raw response");

    let parsed: {
      statDeltas: { perimeter: number; morale: number; resources: number };
      nextScenario: string;
      optionA: string;
      optionB: string;
      analysis: string;
    };

    try {
      parsed = JSON.parse(extractJson(raw));
    } catch (parseErr) {
      req.log.error({ parseErr, raw }, "JSON parse failed");
      res.status(500).json({ error: "AI 回應格式錯誤，請重試" });
      return;
    }

    const clampDelta = (n: unknown) =>
      Math.max(-15, Math.min(15, Math.round(Number(n) || 0)));
    parsed.statDeltas.perimeter = clampDelta(parsed.statDeltas.perimeter);
    parsed.statDeltas.morale = clampDelta(parsed.statDeltas.morale);
    parsed.statDeltas.resources = clampDelta(parsed.statDeltas.resources);

    res.json(parsed);
  } catch (err) {
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
    .map(h => `第${h.round}輪 — 選擇${h.choice}（${h.choiceText.slice(0, 30)}）→ 邊界${h.deltas.perimeter >= 0 ? "+" : ""}${h.deltas.perimeter} 士氣${h.deltas.morale >= 0 ? "+" : ""}${h.deltas.morale} 資源${h.deltas.resources >= 0 ? "+" : ""}${h.deltas.resources}`)
    .join("\n");

  const endReasonText = endReason === "stat_zero"
    ? "因某項指標歸零而提前終止"
    : `完成全部 ${rounds} 輪推演`;

  const userMessage = `玩家已完成領導力推演沙盤，${endReasonText}。

最終指標：權力邊界 ${stats.perimeter}%，團隊士氣 ${stats.morale}%，專案資源 ${stats.resources}%。

完整決策歷程：
${historyText}

請根據以上資訊，輸出深度評估 JSON。`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: EVALUATE_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    req.log.info({ raw }, "AI evaluate raw response");

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
      parsed = JSON.parse(extractJson(raw));
    } catch (parseErr) {
      req.log.error({ parseErr, raw }, "Evaluate JSON parse failed");
      res.status(500).json({ error: "評估報告生成失敗，請重試" });
      return;
    }

    parsed.overallScore = Math.max(0, Math.min(100, Math.round(Number(parsed.overallScore) || 50)));

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "Evaluate AI error");
    res.status(500).json({ error: "AI 評估系統暫時無法回應，請重試" });
  }
});

export default router;

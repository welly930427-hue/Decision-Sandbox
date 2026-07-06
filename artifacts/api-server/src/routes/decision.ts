import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const SYSTEM_PROMPT = `你是一位高階組織戰略與領導力導師，專精於團隊心理學、組織政治學與危機管理。

你負責主持一個互動式領導力推演沙盤模擬器。玩家扮演一位高階主管，需要在複雜的組織局勢中做出決策。

每當玩家做出決策後，你需要：

1. 根據玩家的當前數據（權力邊界、團隊士氣、專案資源）與決策，計算三項指標的合理增減幅度（每項 -15 到 +15 之間的整數，需要有邏輯性，不能全部正向或全部負向）。

2. 產生下一個突發領導力考驗情境（繁體中文，80-120字），必須：
   - 融合團隊心理學（信任危機、權力結構、心理安全感）與策管衝突（資源爭奪、利益博弈、戰略失調）
   - 直接呼應玩家剛才的決策後果
   - 帶有適度的不確定性與壓力感
   - 避免重複之前的情境主題

3. 為新情境提供兩個決策選項 A 和 B（繁體中文，每個 25-40 字），選項需要有明顯的策略取向差異（強硬 vs 懷柔、短期 vs 長期、集權 vs 分權等）。

4. 提供一句精準的戰略分析（繁體中文，30-50 字），評估玩家剛才的決策對組織局勢的影響。

請以嚴格的 JSON 格式回應，不得包含任何 markdown 代碼塊或額外文字：
{
  "statDeltas": {
    "perimeter": <number -15 to 15>,
    "morale": <number -15 to 15>,
    "resources": <number -15 to 15>
  },
  "nextScenario": "<string>",
  "optionA": "<string>",
  "optionB": "<string>",
  "analysis": "<string>"
}`;

router.post("/decision", async (req, res) => {
  try {
    const { choice, choiceText, scenarioText, stats, decisionCount } = req.body as {
      choice: "A" | "B";
      choiceText: string;
      scenarioText: string;
      stats: { perimeter: number; morale: number; resources: number };
      decisionCount: number;
    };

    const userMessage = `
當前局勢數據：
- 權力邊界：${stats.perimeter}%
- 團隊士氣：${stats.morale}%
- 專案資源：${stats.resources}%

決策輪次：第 ${decisionCount + 1} 輪

剛才的情境：
${scenarioText}

玩家選擇了方案 ${choice}：
${choiceText}

請根據以上資訊，依照指定格式回應。`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "";

    let parsed: {
      statDeltas: { perimeter: number; morale: number; resources: number };
      nextScenario: string;
      optionA: string;
      optionB: string;
      analysis: string;
    };

    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        res.status(500).json({ error: "AI 回應格式錯誤，請重試" });
        return;
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    const clampDelta = (n: number) => Math.max(-15, Math.min(15, Math.round(n)));
    parsed.statDeltas.perimeter = clampDelta(parsed.statDeltas.perimeter);
    parsed.statDeltas.morale = clampDelta(parsed.statDeltas.morale);
    parsed.statDeltas.resources = clampDelta(parsed.statDeltas.resources);

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "Decision AI error");
    res.status(500).json({ error: "AI 推演系統暫時無法回應，請重試" });
  }
});

export default router;

import { useState, useEffect, useRef } from "react";

const MAX_ROUNDS = 10;

interface Stat {
  label: string;
  labelEn: string;
  value: number;
  icon: string;
}

interface ScenarioState {
  text: string;
  optionA: string;
  optionB: string;
}

interface HistoryEntry {
  round: number;
  scenarioText: string;
  choice: string;
  choiceText: string;
  deltas: { perimeter: number; morale: number; resources: number };
}

interface EvaluateResult {
  archetype: string;
  archetypeEn: string;
  overallScore: number;
  verdict: string;
  deepAnalysis: string;
  strengths: string[];
  blindspots: string[];
}

const INITIAL_SCENARIO: ScenarioState = {
  text: "核心成員因資源分配不均，出現抗拒心理。財務長私下告知你，若繼續當前路線，六週內將觸底。高層對你的執行力開始出現質疑聲浪。",
  optionA: "A｜重組資源分配方案，暫緩非核心專案，優先穩定核心人員",
  optionB: "B｜維持現有路線，向董事會申請額外資本注入，展現信心",
};

const TRANSITION_MSGS = [
  "決策已記錄，正在推演局勢...",
  "AI 導師介入分析，重新評估戰略態勢...",
  "變數注入完成，重新計算博弈矩陣...",
  "決策向量已鎖定，推演模型執行中...",
  "局勢重組中，等待系統反饋...",
];

function clamp(val: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val));
}

function getBarColor(value: number): string {
  if (value <= 20) return "hsl(0 80% 55%)";
  if (value <= 40) return "hsl(38 95% 55%)";
  if (value <= 75) return "hsl(195 100% 45%)";
  return "hsl(142 70% 45%)";
}

function getStatusLabel(value: number): { text: string; color: string } {
  if (value <= 20) return { text: "危急", color: "hsl(0 80% 55%)" };
  if (value <= 40) return { text: "警戒", color: "hsl(38 95% 55%)" };
  if (value <= 75) return { text: "穩定", color: "hsl(195 100% 45%)" };
  return { text: "優勢", color: "hsl(142 70% 45%)" };
}

function getScoreColor(score: number): string {
  if (score < 30) return "hsl(0 80% 55%)";
  if (score < 55) return "hsl(38 95% 55%)";
  if (score < 75) return "hsl(195 100% 45%)";
  return "hsl(142 70% 45%)";
}

function StatBar({ stat, delta }: { stat: Stat; delta: number | null }) {
  const barColor = getBarColor(stat.value);
  const status = getStatusLabel(stat.value);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{stat.icon}</span>
          <div>
            <div className="text-xs font-mono tracking-widest text-muted-foreground uppercase">{stat.labelEn}</div>
            <div className="text-sm font-semibold text-foreground">{stat.label}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-mono font-bold tabular-nums" style={{ color: barColor }}>
            {stat.value}<span className="text-xs ml-0.5">%</span>
          </div>
          {delta !== null && delta !== 0 && (
            <div className="text-xs font-mono slide-in" style={{ color: delta > 0 ? "hsl(142 70% 45%)" : "hsl(0 80% 55%)" }}>
              {delta > 0 ? `+${delta}` : delta}
            </div>
          )}
          <div className="text-xs font-mono mt-0.5" style={{ color: status.color }}>[{status.text}]</div>
        </div>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full progress-bar-fill"
          style={{
            width: `${stat.value}%`,
            background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
            boxShadow: `0 0 8px ${barColor}66`,
          }}
        />
        <div className="absolute inset-0 scanlines rounded-full opacity-40" />
      </div>
    </div>
  );
}

function EvaluationReport({
  result,
  endReason,
  finalStats,
  rounds,
  onRestart,
}: {
  result: EvaluateResult;
  endReason: "max_rounds" | "stat_zero";
  finalStats: Stat[];
  rounds: number;
  onRestart: () => void;
}) {
  const scoreColor = getScoreColor(result.overallScore);
  const circumference = 2 * Math.PI * 36;
  const dashOffset = circumference * (1 - result.overallScore / 100);

  return (
    <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto slide-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "hsl(195 100% 45%)" }} />
        <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Final Assessment Report — {rounds} Rounds Completed
        </span>
        {endReason === "stat_zero" && (
          <span
            className="ml-auto font-mono text-xs px-2 py-0.5 rounded border tracking-widest"
            style={{ borderColor: "hsl(0 80% 55% / 0.4)", color: "hsl(0 80% 55%)", backgroundColor: "hsl(0 80% 55% / 0.06)" }}
          >
            EARLY TERMINATION
          </span>
        )}
      </div>

      {/* Main report card */}
      <div
        className="rounded-xl border p-6 relative overflow-hidden"
        style={{
          backgroundColor: "hsl(220 18% 7%)",
          borderColor: "hsl(195 100% 45% / 0.2)",
          boxShadow: "0 0 40px hsl(195 100% 45% / 0.06)",
        }}
      >
        <div className="absolute top-0 left-0 w-6 h-6 border-t border-l rounded-tl-xl" style={{ borderColor: "hsl(195 100% 45% / 0.4)" }} />
        <div className="absolute top-0 right-0 w-6 h-6 border-t border-r rounded-tr-xl" style={{ borderColor: "hsl(195 100% 45% / 0.4)" }} />
        <div className="absolute inset-0 scanlines opacity-10 pointer-events-none rounded-xl" />

        {/* Score + Archetype row */}
        <div className="flex items-center gap-6 mb-6">
          {/* Circular score */}
          <div className="relative flex-shrink-0 w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="hsl(220 15% 16%)" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="36" fill="none"
                stroke={scoreColor} strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 4px ${scoreColor}88)` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono font-bold text-lg tabular-nums" style={{ color: scoreColor }}>{result.overallScore}</span>
              <span className="font-mono text-xs text-muted-foreground/60">分</span>
            </div>
          </div>

          {/* Archetype */}
          <div className="flex-1">
            <div className="font-mono text-xs tracking-widest text-muted-foreground/60 uppercase mb-1">Leadership Archetype</div>
            <div className="text-xl font-bold text-foreground leading-tight">{result.archetype}</div>
            <div className="font-mono text-sm mt-0.5" style={{ color: "hsl(195 100% 45% / 0.7)" }}>{result.archetypeEn}</div>
          </div>
        </div>

        {/* Verdict */}
        <div
          className="mb-5 px-4 py-3 rounded-lg border"
          style={{ borderColor: "hsl(38 95% 55% / 0.2)", backgroundColor: "hsl(38 95% 55% / 0.04)" }}
        >
          <div className="font-mono text-xs tracking-widest mb-1.5" style={{ color: "hsl(38 95% 55% / 0.6)" }}>最終裁決</div>
          <p className="text-sm leading-relaxed font-medium" style={{ color: "hsl(38 95% 65%)" }}>{result.verdict}</p>
        </div>

        {/* Deep analysis */}
        <div className="mb-5">
          <div className="font-mono text-xs tracking-widest text-muted-foreground/50 uppercase mb-2">深度點評 · 君王論 × 策略管理</div>
          <p className="text-sm leading-relaxed" style={{ color: "hsl(210 20% 76%)" }}>{result.deepAnalysis}</p>
        </div>

        {/* Strengths & Blindspots */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="font-mono text-xs tracking-widest mb-2" style={{ color: "hsl(142 70% 45% / 0.7)" }}>核心優勢</div>
            <ul className="space-y-1.5">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "hsl(210 20% 72%)" }}>
                  <span style={{ color: "hsl(142 70% 45%)" }}>◆</span>{s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-mono text-xs tracking-widest mb-2" style={{ color: "hsl(0 80% 55% / 0.7)" }}>戰略盲點</div>
            <ul className="space-y-1.5">
              {result.blindspots.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "hsl(210 20% 72%)" }}>
                  <span style={{ color: "hsl(0 80% 55%)" }}>◈</span>{b}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Final stats row */}
        <div className="mt-5 pt-4 border-t grid grid-cols-3 gap-3" style={{ borderColor: "hsl(195 100% 45% / 0.1)" }}>
          {finalStats.map(s => (
            <div key={s.label} className="text-center">
              <div className="font-mono text-xs text-muted-foreground/50 tracking-widest uppercase">{s.labelEn}</div>
              <div className="font-mono text-lg font-bold tabular-nums mt-0.5" style={{ color: getBarColor(s.value) }}>{s.value}%</div>
              <div className="font-mono text-xs" style={{ color: getStatusLabel(s.value).color }}>[{getStatusLabel(s.value).text}]</div>
            </div>
          ))}
        </div>
      </div>

      {/* Restart button */}
      <button
        onClick={onRestart}
        className="btn-decision self-center px-8 py-3 rounded-xl border font-mono text-sm tracking-widest"
        style={{
          borderColor: "hsl(195 100% 45% / 0.3)",
          color: "hsl(195 100% 45%)",
          backgroundColor: "hsl(195 100% 45% / 0.06)",
        }}
      >
        ↺ 重新推演
      </button>
    </div>
  );
}

export default function Simulator() {
  const [stats, setStats] = useState<Stat[]>([
    { label: "權力邊界", labelEn: "Perimeter", value: 50, icon: "◈" },
    { label: "團隊士氣", labelEn: "Morale", value: 50, icon: "◉" },
    { label: "專案資源", labelEn: "Resources", value: 50, icon: "◆" },
  ]);
  const [deltas, setDeltas] = useState<(number | null)[]>([null, null, null]);
  const [scenario, setScenario] = useState<ScenarioState>(INITIAL_SCENARIO);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [decisionCount, setDecisionCount] = useState(0);
  const [lastDecision, setLastDecision] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [isFlickering, setIsFlickering] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Game over state
  const [gameOver, setGameOver] = useState(false);
  const [endReason, setEndReason] = useState<"max_rounds" | "stat_zero">("max_rounds");
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluateResult | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  function restart() {
    setStats([
      { label: "權力邊界", labelEn: "Perimeter", value: 50, icon: "◈" },
      { label: "團隊士氣", labelEn: "Morale", value: 50, icon: "◉" },
      { label: "專案資源", labelEn: "Resources", value: 50, icon: "◆" },
    ]);
    setDeltas([null, null, null]);
    setScenario(INITIAL_SCENARIO);
    setTransitioning(false);
    setTransitionMsg("");
    setAiError(null);
    setDecisionCount(0);
    setLastDecision(null);
    setLastAnalysis(null);
    setLog([]);
    setIsFlickering(false);
    setHistory([]);
    setGameOver(false);
    setEvalResult(null);
    setEvalError(null);
    setEvaluating(false);
  }

  async function triggerGameOver(
    reason: "max_rounds" | "stat_zero",
    finalStats: Stat[],
    finalHistory: HistoryEntry[],
    finalRounds: number,
  ) {
    setGameOver(true);
    setEndReason(reason);
    setEvaluating(true);
    setEvalError(null);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stats: {
            perimeter: finalStats[0].value,
            morale: finalStats[1].value,
            resources: finalStats[2].value,
          },
          history: finalHistory,
          rounds: finalRounds,
          endReason: reason,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "評估失敗" }));
        throw new Error((errData as { error: string }).error || "評估失敗");
      }

      const data = await res.json() as EvaluateResult;
      setEvalResult(data);
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "AI 評估系統暫時無法回應");
    } finally {
      setEvaluating(false);
    }
  }

  async function handleDecision(choice: "A" | "B") {
    if (transitioning || gameOver) return;

    const choiceText = choice === "A" ? scenario.optionA : scenario.optionB;

    setIsFlickering(true);
    setTimeout(() => setIsFlickering(false), 200);

    setTransitioning(true);
    setAiError(null);
    setLastDecision(choiceText);
    setLastAnalysis(null);
    setTransitionMsg(TRANSITION_MSGS[Math.floor(Math.random() * TRANSITION_MSGS.length)]);

    const currentStats = {
      perimeter: stats[0].value,
      morale: stats[1].value,
      resources: stats[2].value,
    };

    try {
      const res = await fetch("/api/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          choice,
          choiceText,
          scenarioText: scenario.text,
          stats: currentStats,
          decisionCount,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "未知錯誤" }));
        throw new Error((errData as { error: string }).error || "AI 系統暫時無法回應");
      }

      const data = await res.json() as {
        statDeltas: { perimeter: number; morale: number; resources: number };
        nextScenario: string;
        optionA: string;
        optionB: string;
        analysis: string;
      };

      const newDeltas = [data.statDeltas.perimeter, data.statDeltas.morale, data.statDeltas.resources];

      const newStats = stats.map((s, i) => ({ ...s, value: clamp(s.value + newDeltas[i]) }));

      setStats(newStats);
      setDeltas(newDeltas);
      const newCount = decisionCount + 1;
      setDecisionCount(newCount);
      setLastAnalysis(data.analysis);

      const newEntry: HistoryEntry = {
        round: newCount,
        scenarioText: scenario.text,
        choice,
        choiceText,
        deltas: { perimeter: newDeltas[0], morale: newDeltas[1], resources: newDeltas[2] },
      };
      const newHistory = [...history, newEntry];
      setHistory(newHistory);

      const timestamp = new Date().toLocaleTimeString("zh-TW", { hour12: false });
      setLog(prev => [
        ...prev,
        `[${timestamp}] 輪次 ${newCount} — 選擇${choice}：${choiceText.slice(0, 20)}...`,
        `         ↳ 邊界 ${newDeltas[0] >= 0 ? "+" : ""}${newDeltas[0]}  |  士氣 ${newDeltas[1] >= 0 ? "+" : ""}${newDeltas[1]}  |  資源 ${newDeltas[2] >= 0 ? "+" : ""}${newDeltas[2]}`,
      ]);

      // Check end conditions
      const statZero = newStats.some(s => s.value <= 0);
      const maxReached = newCount >= MAX_ROUNDS;

      if (statZero || maxReached) {
        const reason = statZero ? "stat_zero" : "max_rounds";
        setTimeout(() => {
          setTransitioning(false);
          setDeltas([null, null, null]);
          triggerGameOver(reason, newStats, newHistory, newCount);
        }, 1800);
      } else {
        setTimeout(() => {
          setScenario({ text: data.nextScenario, optionA: data.optionA, optionB: data.optionB });
          setTransitioning(false);
          setDeltas([null, null, null]);
          setLastAnalysis(null);
        }, 1800);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI 推演失敗，請重試";
      setAiError(msg);
      setTransitioning(false);
      setTransitionMsg("");
    }
  }

  const overallHealth = Math.round(stats.reduce((s, x) => s + x.value, 0) / 3);

  const roundsLabel = `${decisionCount} / ${MAX_ROUNDS}`;

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "var(--app-font-sans)" }}>
      {/* Top bar */}
      <header className="border-b border-border/50 bg-card/60 backdrop-blur-sm px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="pulse-dot w-2 h-2 rounded-full" style={{ backgroundColor: "hsl(195 100% 45%)", color: "hsl(195 100% 45%)" }} />
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Decision Boundary Terminal</span>
          <span className="text-muted-foreground/40 text-xs">v2.4.1 · AI</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="font-mono text-xs text-muted-foreground tracking-widest">決策輪次</div>
            <div className="font-mono text-base font-bold" style={{ color: "hsl(195 100% 45%)" }}>{roundsLabel}</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-xs text-muted-foreground tracking-widest">整體態勢</div>
            <div className="font-mono text-base font-bold" style={{ color: getBarColor(overallHealth) }}>{overallHealth}%</div>
          </div>
          <div
            className="px-3 py-1 rounded font-mono text-xs border tracking-widest flex items-center gap-1.5"
            style={{
              borderColor: gameOver ? "hsl(38 95% 55% / 0.3)" : "hsl(195 100% 45% / 0.3)",
              color: gameOver ? "hsl(38 95% 55%)" : "hsl(195 100% 45%)",
              backgroundColor: gameOver ? "hsl(38 95% 55% / 0.06)" : "hsl(195 100% 45% / 0.06)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ backgroundColor: gameOver ? "hsl(38 95% 55%)" : "hsl(195 100% 45%)", color: gameOver ? "hsl(38 95% 55%)" : "hsl(195 100% 45%)" }} />
            {gameOver ? "推演結束" : "AI 推演中"}
          </div>
        </div>
      </header>

      {/* Title strip */}
      <div className="py-2 px-6 border-b flex items-center gap-4" style={{ borderColor: "hsl(195 100% 45% / 0.15)", backgroundColor: "hsl(195 100% 45% / 0.03)" }}>
        <div className="font-mono text-xs text-muted-foreground tracking-widest uppercase">CLASSIFIED</div>
        <div className="flex-1 h-px bg-border/40" />
        <h1 className="text-sm font-semibold tracking-widest text-foreground/80 uppercase">決策邊界 · 領導力推演沙盤</h1>
        <div className="flex-1 h-px bg-border/40" />
        <div className="font-mono text-xs text-muted-foreground tracking-widest uppercase">CLASSIFIED</div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT */}
        <aside className="w-80 flex-shrink-0 border-r flex flex-col" style={{ borderColor: "hsl(195 100% 45% / 0.12)" }}>
          <div className="p-4 border-b" style={{ borderColor: "hsl(195 100% 45% / 0.1)" }}>
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "hsl(195 100% 45%)" }} />
              <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Status Dashboard</span>
            </div>
          </div>

          <div className="flex-1 p-5 space-y-6">
            {stats.map((stat, i) => (
              <div key={stat.label} className="p-4 rounded-lg border" style={{ backgroundColor: "hsl(220 18% 8%)", borderColor: stat.value <= 0 ? "hsl(0 80% 55% / 0.4)" : "hsl(195 100% 45% / 0.1)" }}>
                <StatBar stat={stat} delta={deltas[i]} />
              </div>
            ))}
          </div>

          {/* Round progress bar */}
          <div className="px-5 pb-4">
            <div className="flex justify-between font-mono text-xs text-muted-foreground/50 mb-1.5">
              <span className="uppercase tracking-widest">Round Progress</span>
              <span>{decisionCount}/{MAX_ROUNDS}</span>
            </div>
            <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full progress-bar-fill"
                style={{
                  width: `${(decisionCount / MAX_ROUNDS) * 100}%`,
                  background: "linear-gradient(90deg, hsl(195 100% 45% / 0.6), hsl(195 100% 45%))",
                }}
              />
            </div>
          </div>

          {/* Decision log */}
          <div className="border-t" style={{ borderColor: "hsl(195 100% 45% / 0.1)" }}>
            <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: "hsl(195 100% 45% / 0.08)" }}>
              <div className="w-1 h-3 rounded-full bg-muted-foreground/40" />
              <span className="font-mono text-xs tracking-widest text-muted-foreground/60 uppercase">Decision Log</span>
            </div>
            <div className="h-36 overflow-y-auto p-3 space-y-1">
              {log.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground/40 italic">尚無決策記錄...</p>
              ) : (
                log.map((entry, i) => (
                  <div key={i} className="font-mono text-xs leading-relaxed" style={{ color: i % 2 === 0 ? "hsl(195 100% 45% / 0.7)" : "hsl(210 15% 52%)" }}>
                    {entry}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </aside>

        {/* RIGHT */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {gameOver ? (
            /* ─── GAME OVER: Evaluation ─── */
            evaluating ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "hsl(195 100% 45%)", animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                <p className="font-mono text-base tracking-wider text-center typewriter-cursor" style={{ color: "hsl(195 100% 45%)" }}>
                  正在生成領導力綜合評估報告...
                </p>
                <p className="font-mono text-xs text-muted-foreground/50 text-center">
                  AI 導師正結合《君王論》與策略管理框架分析你的決策模式
                </p>
              </div>
            ) : evalError ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                <div className="font-mono text-xs px-3 py-1 rounded border tracking-widest" style={{ borderColor: "hsl(0 80% 55% / 0.4)", color: "hsl(0 80% 55%)", backgroundColor: "hsl(0 80% 55% / 0.06)" }}>
                  EVALUATION ERROR
                </div>
                <p className="font-mono text-sm text-center" style={{ color: "hsl(0 80% 65%)" }}>{evalError}</p>
                <button
                  onClick={() => triggerGameOver(endReason, stats, history, decisionCount)}
                  className="btn-decision px-6 py-2 rounded-lg border font-mono text-xs tracking-widest"
                  style={{ borderColor: "hsl(195 100% 45% / 0.3)", color: "hsl(195 100% 45%)", backgroundColor: "hsl(195 100% 45% / 0.06)" }}
                >
                  重新生成報告
                </button>
              </div>
            ) : evalResult ? (
              <EvaluationReport
                result={evalResult}
                endReason={endReason}
                finalStats={stats}
                rounds={decisionCount}
                onRestart={restart}
              />
            ) : null
          ) : (
            /* ─── ACTIVE GAME ─── */
            <>
              <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "hsl(195 100% 45%)" }} />
                  <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                    Situation Report — Round {decisionCount + 1}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="font-mono text-xs text-muted-foreground/40">Powered by</span>
                    <span className="font-mono text-xs font-semibold" style={{ color: "hsl(195 100% 45% / 0.7)" }}>GPT-5 · AI Dynamics</span>
                  </div>
                </div>

                {/* Scenario box */}
                <div
                  className={`flex-1 rounded-xl border p-6 relative overflow-hidden flex flex-col justify-between ${isFlickering ? "flicker" : ""}`}
                  style={{
                    backgroundColor: "hsl(220 18% 7%)",
                    borderColor: aiError ? "hsl(0 80% 55% / 0.4)" : "hsl(195 100% 45% / 0.18)",
                    boxShadow: "0 0 30px hsl(195 100% 45% / 0.04), inset 0 0 60px hsl(220 20% 6% / 0.5)",
                  }}
                >
                  <div className="absolute top-0 left-0 w-6 h-6 border-t border-l rounded-tl-xl" style={{ borderColor: "hsl(195 100% 45% / 0.4)" }} />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t border-r rounded-tr-xl" style={{ borderColor: "hsl(195 100% 45% / 0.4)" }} />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l rounded-bl-xl" style={{ borderColor: "hsl(195 100% 45% / 0.4)" }} />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b border-r rounded-br-xl" style={{ borderColor: "hsl(195 100% 45% / 0.4)" }} />
                  <div className="absolute inset-0 scanlines opacity-20 pointer-events-none rounded-xl" />

                  {aiError ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                      <div className="font-mono text-xs px-3 py-1 rounded border tracking-widest" style={{ borderColor: "hsl(0 80% 55% / 0.4)", color: "hsl(0 80% 55%)", backgroundColor: "hsl(0 80% 55% / 0.06)" }}>
                        SYSTEM ERROR
                      </div>
                      <p className="font-mono text-sm text-center" style={{ color: "hsl(0 80% 65%)" }}>{aiError}</p>
                      <p className="font-mono text-xs text-muted-foreground/50">請重新選擇決策方案...</p>
                    </div>
                  ) : transitioning ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-5">
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "hsl(195 100% 45%)", animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                        ))}
                      </div>
                      <p className="font-mono text-base tracking-wider text-center typewriter-cursor" style={{ color: "hsl(195 100% 45%)" }}>
                        {transitionMsg}
                      </p>
                      {lastDecision && (
                        <div className="px-4 py-2 rounded border font-mono text-xs text-center max-w-md" style={{ borderColor: "hsl(195 100% 45% / 0.2)", color: "hsl(195 100% 45% / 0.6)", backgroundColor: "hsl(195 100% 45% / 0.04)" }}>
                          {lastDecision}
                        </div>
                      )}
                      {lastAnalysis && (
                        <div className="mt-2 px-5 py-3 rounded-lg border max-w-lg text-center slide-in" style={{ borderColor: "hsl(38 95% 55% / 0.2)", backgroundColor: "hsl(38 95% 55% / 0.04)" }}>
                          <div className="font-mono text-xs tracking-widest mb-1" style={{ color: "hsl(38 95% 55% / 0.6)" }}>AI 導師戰略評析</div>
                          <p className="text-sm leading-relaxed" style={{ color: "hsl(38 95% 65%)" }}>{lastAnalysis}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3 mb-auto">
                        <div className="mt-1 flex-shrink-0 font-mono text-xs px-2 py-0.5 rounded border tracking-widest" style={{ borderColor: "hsl(195 100% 45% / 0.3)", color: "hsl(195 100% 45%)", backgroundColor: "hsl(195 100% 45% / 0.06)" }}>
                          ALERT
                        </div>
                        <p className="text-lg leading-relaxed font-medium slide-in" style={{ color: "hsl(210 20% 85%)" }}>{scenario.text}</p>
                      </div>
                      <div className="mt-6 pt-4 border-t" style={{ borderColor: "hsl(195 100% 45% / 0.1)" }}>
                        <div className="font-mono text-xs tracking-widest text-muted-foreground/50 uppercase mb-1">等待決策指令 —</div>
                        <div className="font-mono text-xs text-muted-foreground/40">
                          請從下方選擇行動方案，AI 導師將即時推演影響 · 剩餘 {MAX_ROUNDS - decisionCount} 輪
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Decision buttons */}
              <div className="border-t p-6" style={{ borderColor: "hsl(195 100% 45% / 0.12)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1 h-4 rounded-full bg-muted-foreground/30" />
                  <span className="font-mono text-xs tracking-widest text-muted-foreground/60 uppercase">Decision Matrix — Select Action</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {(["A", "B"] as const).map(key => (
                    <button
                      key={key}
                      onClick={() => handleDecision(key)}
                      disabled={transitioning}
                      className="btn-decision p-4 rounded-xl border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: "hsl(220 18% 8%)",
                        borderColor: "hsl(195 100% 45% / 0.2)",
                        cursor: transitioning ? "not-allowed" : "pointer",
                      }}
                    >
                      <div className="font-mono text-xs tracking-widest mb-2 font-bold" style={{ color: "hsl(195 100% 45%)" }}>─ 方案 {key} ─</div>
                      <div className="text-sm leading-relaxed" style={{ color: "hsl(210 20% 76%)" }}>
                        {key === "A" ? scenario.optionA : scenario.optionB}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: "hsl(220 15% 14%)" }}>
                  <div className="font-mono text-xs text-muted-foreground/40">每次決策將由 AI 動態推演影響 · 數值邊界 0–100 · 最多 {MAX_ROUNDS} 輪</div>
                  <div className="font-mono text-xs text-muted-foreground/30 tracking-widest">SIMULATION ENGINE · BUILD 2041</div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

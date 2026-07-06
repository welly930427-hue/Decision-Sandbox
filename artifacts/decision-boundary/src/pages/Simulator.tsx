import { useState, useEffect, useRef } from "react";

interface Stat {
  label: string;
  labelEn: string;
  value: number;
  icon: string;
}

interface Scenario {
  id: number;
  text: string;
  optionA: string;
  optionB: string;
  effectsA: { perimeter: number; morale: number; resources: number };
  effectsB: { perimeter: number; morale: number; resources: number };
}

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    text: "核心成員因資源分配不均，出現抗拒心理。財務長私下告知你，若繼續當前路線，六週內將觸底。",
    optionA: "A｜重組資源分配方案，暫緩非核心專案",
    optionB: "B｜維持現有路線，向董事會申請額外資本注入",
    effectsA: { perimeter: 5, morale: 8, resources: -6 },
    effectsB: { perimeter: -7, morale: -4, resources: 9 },
  },
  {
    id: 2,
    text: "競對方突然宣布與你最大客戶達成獨家合作。消息在內部迅速擴散，團隊士氣開始動搖。",
    optionA: "A｜立即召開全員說明會，公開應對策略",
    optionB: "B｜低調部署反制方案，以行動代替宣示",
    effectsA: { perimeter: -5, morale: 9, resources: -4 },
    effectsB: { perimeter: 7, morale: -6, resources: -5 },
  },
  {
    id: 3,
    text: "一名技術骨幹收到外部高薪邀約，正式提出離職意向。他掌握關鍵系統架構知識，交接窗口極短。",
    optionA: "A｜提供股份留才，並重組薪酬結構",
    optionB: "B｜接受離職，加速知識移轉並對外招募替代者",
    effectsA: { perimeter: 3, morale: 6, resources: -9 },
    effectsB: { perimeter: -4, morale: -7, resources: 8 },
  },
  {
    id: 4,
    text: "監管機構發布新合規要求，執行期限僅剩九十天。法務估算合規成本將吃掉本季盈餘的四成。",
    optionA: "A｜全力執行合規，向市場展現治理能力",
    optionB: "B｜申請延期同時進行政策遊說，爭取緩衝空間",
    effectsA: { perimeter: 8, morale: 4, resources: -8 },
    effectsB: { perimeter: -6, morale: 3, resources: 5 },
  },
  {
    id: 5,
    text: "兩位部門主管因策略路線分歧公開衝突，導致跨部門協作陷入僵局，專案交付風險急速上升。",
    optionA: "A｜親自介入仲裁，強制設立統一決策機制",
    optionB: "B｜讓雙方提出方案並進行內部評審，由結果定奪",
    effectsA: { perimeter: 9, morale: -5, resources: -3 },
    effectsB: { perimeter: -4, morale: 7, resources: -4 },
  },
];

const TRANSITION_TEXTS = [
  "決策已記錄，正在推演局勢...",
  "指令接收，系統重新評估戰略態勢...",
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

function StatBar({ stat, delta }: { stat: Stat; delta: number | null }) {
  const barColor = getBarColor(stat.value);
  const status = getStatusLabel(stat.value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{stat.icon}</span>
          <div>
            <div className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
              {stat.labelEn}
            </div>
            <div className="text-sm font-semibold text-foreground">
              {stat.label}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div
            className="text-xl font-mono font-bold tabular-nums"
            style={{ color: barColor }}
          >
            {stat.value}
            <span className="text-xs ml-0.5">%</span>
          </div>
          {delta !== null && delta !== 0 && (
            <div
              className="text-xs font-mono slide-in"
              style={{ color: delta > 0 ? "hsl(142 70% 45%)" : "hsl(0 80% 55%)" }}
            >
              {delta > 0 ? `+${delta}` : delta}
            </div>
          )}
          <div className="text-xs font-mono mt-0.5" style={{ color: status.color }}>
            [{status.text}]
          </div>
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
        <div
          className="absolute inset-0 scanlines rounded-full opacity-40"
        />
      </div>
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
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [scenarioText, setScenarioText] = useState(SCENARIOS[0].text);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState("");
  const [decisionCount, setDecisionCount] = useState(0);
  const [lastDecision, setLastDecision] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [isFlickering, setIsFlickering] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const currentScenario = SCENARIOS[scenarioIndex];

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  function applyEffects(baseEffects: { perimeter: number; morale: number; resources: number }) {
    const jitter = (base: number) => {
      const sign = base >= 0 ? 1 : -1;
      const magnitude = Math.abs(base) + Math.floor(Math.random() * 5) - 2;
      return sign * Math.max(1, magnitude);
    };

    return {
      perimeter: jitter(baseEffects.perimeter),
      morale: jitter(baseEffects.morale),
      resources: jitter(baseEffects.resources),
    };
  }

  function handleDecision(choice: "A" | "B") {
    if (transitioning) return;

    const effects = choice === "A"
      ? applyEffects(currentScenario.effectsA)
      : applyEffects(currentScenario.effectsB);

    const newDeltas = [effects.perimeter, effects.morale, effects.resources];

    setIsFlickering(true);
    setTimeout(() => setIsFlickering(false), 200);

    setTransitioning(true);
    setLastDecision(choice === "A" ? currentScenario.optionA : currentScenario.optionB);
    const msg = TRANSITION_TEXTS[Math.floor(Math.random() * TRANSITION_TEXTS.length)];
    setTransitionMsg(msg);

    setStats(prev =>
      prev.map((s, i) => ({
        ...s,
        value: clamp(s.value + newDeltas[i]),
      }))
    );
    setDeltas(newDeltas);
    setDecisionCount(c => c + 1);

    const timestamp = new Date().toLocaleTimeString("zh-TW", { hour12: false });
    setLog(prev => [
      ...prev,
      `[${timestamp}] 情境 ${scenarioIndex + 1} — 選擇${choice}：${choice === "A" ? currentScenario.optionA : currentScenario.optionB}`,
      `         ↳ 權力邊界 ${newDeltas[0] >= 0 ? "+" : ""}${newDeltas[0]}  |  團隊士氣 ${newDeltas[1] >= 0 ? "+" : ""}${newDeltas[1]}  |  專案資源 ${newDeltas[2] >= 0 ? "+" : ""}${newDeltas[2]}`,
    ]);

    setTimeout(() => {
      const nextIndex = (scenarioIndex + 1) % SCENARIOS.length;
      setScenarioIndex(nextIndex);
      setScenarioText(SCENARIOS[nextIndex].text);
      setTransitioning(false);
      setDeltas([null, null, null]);
    }, 2200);
  }

  const overallHealth = Math.round(stats.reduce((s, x) => s + x.value, 0) / 3);

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "var(--app-font-sans)" }}>
      {/* Top bar */}
      <header className="border-b border-border/50 bg-card/60 backdrop-blur-sm px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="pulse-dot w-2 h-2 rounded-full"
            style={{ backgroundColor: "hsl(195 100% 45%)", color: "hsl(195 100% 45%)" }}
          />
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Decision Boundary Terminal
          </span>
          <span className="text-muted-foreground/40 text-xs">v2.4.1</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="font-mono text-xs text-muted-foreground tracking-widest">決策輪次</div>
            <div className="font-mono text-base font-bold" style={{ color: "hsl(195 100% 45%)" }}>
              {String(decisionCount).padStart(3, "0")}
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-xs text-muted-foreground tracking-widest">整體態勢</div>
            <div
              className="font-mono text-base font-bold"
              style={{ color: getBarColor(overallHealth) }}
            >
              {overallHealth}%
            </div>
          </div>
          <div
            className="px-3 py-1 rounded font-mono text-xs border tracking-widest"
            style={{
              borderColor: "hsl(195 100% 45% / 0.3)",
              color: "hsl(195 100% 45%)",
              backgroundColor: "hsl(195 100% 45% / 0.06)",
            }}
          >
            推演中
          </div>
        </div>
      </header>

      {/* Title strip */}
      <div
        className="py-2 px-6 border-b flex items-center gap-4"
        style={{
          borderColor: "hsl(195 100% 45% / 0.15)",
          backgroundColor: "hsl(195 100% 45% / 0.03)",
        }}
      >
        <div className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
          CLASSIFIED
        </div>
        <div className="flex-1 h-px bg-border/40" />
        <h1 className="text-sm font-semibold tracking-widest text-foreground/80 uppercase">
          決策邊界 · 領導力推演沙盤
        </h1>
        <div className="flex-1 h-px bg-border/40" />
        <div className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
          CLASSIFIED
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Status Dashboard */}
        <aside
          className="w-80 flex-shrink-0 border-r flex flex-col"
          style={{ borderColor: "hsl(195 100% 45% / 0.12)" }}
        >
          <div className="p-4 border-b" style={{ borderColor: "hsl(195 100% 45% / 0.1)" }}>
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "hsl(195 100% 45%)" }} />
              <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                Status Dashboard
              </span>
            </div>
          </div>

          <div className="flex-1 p-5 space-y-6">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: "hsl(220 18% 8%)",
                  borderColor: "hsl(195 100% 45% / 0.1)",
                }}
              >
                <StatBar stat={stat} delta={deltas[i]} />
              </div>
            ))}
          </div>

          {/* Decision log */}
          <div
            className="border-t"
            style={{ borderColor: "hsl(195 100% 45% / 0.1)" }}
          >
            <div
              className="px-4 py-2 border-b flex items-center gap-2"
              style={{ borderColor: "hsl(195 100% 45% / 0.08)" }}
            >
              <div className="w-1 h-3 rounded-full bg-muted-foreground/40" />
              <span className="font-mono text-xs tracking-widest text-muted-foreground/60 uppercase">
                Decision Log
              </span>
            </div>
            <div className="h-36 overflow-y-auto p-3 space-y-1">
              {log.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground/40 italic">
                  尚無決策記錄...
                </p>
              ) : (
                log.map((entry, i) => (
                  <div
                    key={i}
                    className="font-mono text-xs leading-relaxed"
                    style={{ color: i % 2 === 0 ? "hsl(195 100% 45% / 0.7)" : "hsl(210 15% 52%)" }}
                  >
                    {entry}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </aside>

        {/* RIGHT: Simulation Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Scenario display */}
          <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
            {/* Section label */}
            <div className="flex items-center gap-3">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "hsl(195 100% 45%)" }} />
              <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                Situation Report — Scenario {scenarioIndex + 1}/{SCENARIOS.length}
              </span>
            </div>

            {/* Scenario box */}
            <div
              className={`flex-1 rounded-xl border p-6 relative overflow-hidden flex flex-col justify-between ${isFlickering ? "flicker" : ""}`}
              style={{
                backgroundColor: "hsl(220 18% 7%)",
                borderColor: "hsl(195 100% 45% / 0.18)",
                boxShadow: "0 0 30px hsl(195 100% 45% / 0.04), inset 0 0 60px hsl(220 20% 6% / 0.5)",
              }}
            >
              {/* Corner decorations */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t border-l rounded-tl-xl" style={{ borderColor: "hsl(195 100% 45% / 0.4)" }} />
              <div className="absolute top-0 right-0 w-6 h-6 border-t border-r rounded-tr-xl" style={{ borderColor: "hsl(195 100% 45% / 0.4)" }} />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l rounded-bl-xl" style={{ borderColor: "hsl(195 100% 45% / 0.4)" }} />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b border-r rounded-br-xl" style={{ borderColor: "hsl(195 100% 45% / 0.4)" }} />

              {/* Scanline overlay */}
              <div className="absolute inset-0 scanlines opacity-20 pointer-events-none rounded-xl" />

              {transitioning ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: "hsl(195 100% 45%)",
                          animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                  <p
                    className="font-mono text-base tracking-wider text-center typewriter-cursor"
                    style={{ color: "hsl(195 100% 45%)" }}
                  >
                    {transitionMsg}
                  </p>
                  {lastDecision && (
                    <div
                      className="mt-2 px-4 py-2 rounded border font-mono text-xs text-center max-w-md"
                      style={{
                        borderColor: "hsl(195 100% 45% / 0.2)",
                        color: "hsl(195 100% 45% / 0.6)",
                        backgroundColor: "hsl(195 100% 45% / 0.04)",
                      }}
                    >
                      {lastDecision}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 mb-auto">
                    <div
                      className="mt-1 flex-shrink-0 font-mono text-xs px-2 py-0.5 rounded border tracking-widest"
                      style={{
                        borderColor: "hsl(195 100% 45% / 0.3)",
                        color: "hsl(195 100% 45%)",
                        backgroundColor: "hsl(195 100% 45% / 0.06)",
                      }}
                    >
                      ALERT
                    </div>
                    <p
                      className="text-lg leading-relaxed font-medium slide-in"
                      style={{ color: "hsl(210 20% 85%)" }}
                    >
                      {scenarioText}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t" style={{ borderColor: "hsl(195 100% 45% / 0.1)" }}>
                    <div className="font-mono text-xs tracking-widest text-muted-foreground/50 uppercase mb-2">
                      等待決策指令 —
                    </div>
                    <div className="font-mono text-xs text-muted-foreground/40">
                      請從下方選擇行動方案，系統將即時推演戰略影響...
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Decision buttons */}
          <div
            className="border-t p-6"
            style={{ borderColor: "hsl(195 100% 45% / 0.12)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-4 rounded-full bg-muted-foreground/30" />
              <span className="font-mono text-xs tracking-widest text-muted-foreground/60 uppercase">
                Decision Matrix — Select Action
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "A" as const, label: currentScenario.optionA },
                { key: "B" as const, label: currentScenario.optionB },
              ].map(({ key, label }) => (
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
                  <div
                    className="font-mono text-xs tracking-widest mb-2 font-bold"
                    style={{ color: "hsl(195 100% 45%)" }}
                  >
                    ─ 方案 {key} ─
                  </div>
                  <div className="text-sm leading-relaxed" style={{ color: "hsl(210 20% 76%)" }}>
                    {label}
                  </div>
                </button>
              ))}
            </div>

            <div
              className="mt-4 pt-4 border-t flex items-center justify-between"
              style={{ borderColor: "hsl(220 15% 14%)" }}
            >
              <div className="font-mono text-xs text-muted-foreground/40">
                每次決策將影響三項核心指標 · 數值邊界 0–100
              </div>
              <div className="font-mono text-xs text-muted-foreground/30 tracking-widest">
                SIMULATION ENGINE · BUILD 2041
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

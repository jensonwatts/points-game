"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────
type Activity = { key: string; label: string; points: number };
type Counts = Record<string, number>;
type DailyRow = { day: string; players: Record<string, Counts> };
type GameState = {
    roomId: string;
    title: string;
    subtitle: string;
    challengeEnds: string;
    activities: Activity[];
    players: string[];
    weeklyCounts: Record<string, Counts>;
    daily: DailyRow[];
    updatedAt: string;
};

// ── Defaults ──────────────────────────────────────────────────────────────────
const defaultActivities: Activity[] = [
  { key: "qualified", label: "Qualified Appt", points: 2 },
  { key: "referrals", label: "Referrals", points: 3 },
  { key: "cvs", label: "CVs Sent", points: 3 },
  { key: "interviewed", label: "Interviewed", points: 5 },
  { key: "bdCalls", label: "BD Calls", points: 2 },
  { key: "jobs", label: "Jobs", points: 5 },
  { key: "leads", label: "Leads", points: 4 },
  ];
const defaultPlayers = ["JW", "PS"];
const localStorageKey = "points-game-v2";
const roomId = "office-points-game";

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase =
    SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function emptyCounts(activities: Activity[]): Counts {
    return Object.fromEntries(activities.map((a) => [a.key, 0]));
}

function buildDefaultState(): GameState {
    const activities = defaultActivities;
    const players = defaultPlayers;
    return {
          roomId,
          title: "BOURNE SEARCH",
          subtitle: "Connecting Talent. Powering FinTech.",
          challengeEnds: "",
          activities,
          players,
          weeklyCounts: Object.fromEntries(players.map((p) => [p, emptyCounts(activities)])),
          daily: [],
          updatedAt: new Date().toISOString(),
    };
}

function scoreFromCounts(counts: Counts, activities: Activity[]): number {
    return (activities || []).reduce(
          (sum, a) => sum + (counts?.[a.key] || 0) * a.points,
          0
        );
}

async function fetchGame(): Promise<GameState | null> {
    if (!supabase) return null;
    const { data } = await supabase
      .from("points_games")
      .select("payload")
      .eq("room_id", roomId)
      .single();
    return data?.payload ?? null;
}

async function upsertGame(state: GameState) {
    if (!supabase) return;
    await supabase.from("points_games").upsert({
          room_id: roomId,
          payload: state,
          updated_at: new Date().toISOString(),
    });
}

// ── Inline SVG Icons ──────────────────────────────────────────────────────────
function Icon({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
    const s = size;
    const icons: Record<string, React.ReactNode> = {
          trophy: (
                  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                          <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                  </svg>svg>
                ),
          users: (
                  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>svg>
                ),
          target: (
                  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                  </svg>svg>
                ),
          plus: (
                  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>svg>
                ),
          minus: (
                  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>svg>
                ),
          x: (
                  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>svg>
                ),
          cloud: (
                  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
                  </svg>svg>
                ),
          wifioff: (
                  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="1" y1="1" x2="23" y2="23"/>
                          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
                          <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
                          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
                  </svg>svg>
                ),
          reset: (
                  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                          <path d="M3 3v5h5"/>
                  </svg>svg>
                ),
    };
    return (
          <span className={className} style={{ display: "inline-flex", alignItems: "center" }}>
            {icons[name] ?? null}
          </span>span>
        );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function App() {
    const [state, setState] = useState<GameState>(buildDefaultState);
    const [synced, setSynced] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    const [newPlayer, setNewPlayer] = useState("");
    const [newKpi, setNewKpi] = useState("");
    const [newKpiPoints, setNewKpiPoints] = useState(1);
    const [tab, setTab] = useState<"tracker" | "leaderboard" | "settings">("tracker");
  
    // ── Load from Supabase or localStorage ──
    useEffect(() => {
          (async () => {
                  const remote = await fetchGame();
                  if (remote) {
                            setState(remote);
                            setSynced(true);
                            setLastSaved(new Date().toLocaleString());
                  } else {
                            const saved = localStorage.getItem(localStorageKey);
                            if (saved) {
                                        try {
                                                      setState(JSON.parse(saved));
                                        } catch {}
                            }
                  }
          })();
    }, []);
  
    // ── Save on change ──
    useEffect(() => {
          localStorage.setItem(localStorageKey, JSON.stringify(state));
          upsertGame(state).then(() => {
                  setSynced(true);
                  setLastSaved(new Date().toLocaleString());
          });
    }, [state]);
  
    // ── Realtime subscription ──
    useEffect(() => {
          if (!supabase) return;
          const channel = supabase
                  .channel("points-sync")
                  .on(
                            "postgres_changes",
                    { event: "*", schema: "public", table: "points_games", filter: `room_id=eq.${roomId}` },
                            (payload) => {
                                        const row = payload.new as { payload?: GameState } | null;
                                        const nextState = row?.payload;
                                        if (nextState) {
                                                      setState(nextState);
                                                      setLastSaved(new Date().toLocaleString());
                                        }
                            }
                          )
                  .subscribe();
          return () => { supabase.removeChannel(channel); };
    }, []);
  
    // ── Computed ──
    const totals = useMemo(
          () =>
                  Object.fromEntries(
                            (state.players || []).map((player) => [
                                        player,
                                        scoreFromCounts((state.weeklyCounts?.[player]) || {}, state.activities || []),
                                      ])
                          ),
          [state]
        );
  
    const sortedPlayers = useMemo(
          () => [...(state.players || [])].sort((a, b) => (totals[b] || 0) - (totals[a] || 0)),
          [state.players, totals]
        );
  
    const maxScore = Math.max(...Object.values(totals), 1);
  
    // ── Actions ──
    function updateCount(player: string, key: string, delta: number) {
          setState((prev) => ({
                  ...prev,
                  updatedAt: new Date().toISOString(),
                  weeklyCounts: {
                            ...(prev.weeklyCounts || {}),
                            [player]: {
                                        ...((prev.weeklyCounts && prev.weeklyCounts[player]) || {}),
                                        [key]: Math.max(0, ((prev.weeklyCounts?.[player]?.[key] || 0) + delta)),
                            },
                  },
          }));
    }
  
    function addPlayer() {
          const name = newPlayer.trim().toUpperCase();
          if (!name || (state.players || []).includes(name)) return;
          setState((prev) => ({
                  ...prev,
                  players: [...(prev.players || []), name],
                  weeklyCounts: {
                            ...(prev.weeklyCounts || {}),
                            [name]: emptyCounts(prev.activities || []),
                  },
                  daily: (prev.daily || []).map((d) => ({
                            ...d,
                            players: { ...d.players, [name]: emptyCounts(prev.activities || []) },
                  })),
          }));
          setNewPlayer("");
    }
  
    function removePlayer(player: string) {
          setState((prev) => {
                  const newPlayers = (prev.players || []).filter((p) => p !== player);
                  const newCounts = { ...(prev.weeklyCounts || {}) };
                  delete newCounts[player];
                  const newDaily = (prev.daily || []).map((d) => {
                            const copy = { ...d.players };
                            delete copy[player];
                            return { ...d, players: copy };
                  });
                  return { ...prev, players: newPlayers, weeklyCounts: newCounts, daily: newDaily };
          });
    }
  
    function addKpi() {
          const label = newKpi.trim();
          if (!label) return;
          const key = label.toLowerCase().replace(/\s+/g, "");
          if ((state.activities || []).find((a) => a.key === key)) return;
          setState((prev) => ({
                  ...prev,
                  activities: [...(prev.activities || []), { key, label, points: newKpiPoints }],
                  weeklyCounts: Object.fromEntries(
                            (prev.players || []).map((p) => [
                                        p,
                              { ...((prev.weeklyCounts || {})[p] || {}), [key]: 0 },
                                      ])
                          ),
          }));
          setNewKpi("");
          setNewKpiPoints(1);
    }
  
    function removeKpi(key: string) {
          setState((prev) => ({
                  ...prev,
                  activities: (prev.activities || []).filter((a) => a.key !== key),
                  weeklyCounts: Object.fromEntries(
                            (prev.players || []).map((p) => {
                                        const counts = { ...((prev.weeklyCounts || {})[p] || {}) };
                                        delete counts[key];
                                        return [p, counts];
                            })
                          ),
          }));
    }
  
    function resetWeek() {
          if (!confirm("Reset all weekly counts? This cannot be undone.")) return;
          setState((prev) => ({
                  ...prev,
                  weeklyCounts: Object.fromEntries(
                            (prev.players || []).map((p) => [p, emptyCounts(prev.activities || [])])
                          ),
                  updatedAt: new Date().toISOString(),
          }));
    }
  
    // ── Styles (inline for zero-dep) ──
    const dark = "#020617";
    const card = "rgba(15,23,42,0.85)";
    const border = "rgba(255,255,255,0.08)";
    const accent = "#38bdf8";
    const mutedText = "#94a3b8";
  
    const cardStyle: React.CSSProperties = {
          background: card,
          border: `1px solid ${border}`,
          borderRadius: 20,
          padding: 20,
          backdropFilter: "blur(12px)",
          marginBottom: 16,
    };
  
    const btnBase: React.CSSProperties = {
          border: "none",
          cursor: "pointer",
          borderRadius: 12,
          padding: "8px 12px",
          fontWeight: 700,
          fontSize: 13,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
    };
  
    const inputStyle: React.CSSProperties = {
          background: "rgba(255,255,255,0.06)",
          border: `1px solid ${border}`,
          borderRadius: 12,
          padding: "8px 14px",
          color: "white",
          fontSize: 14,
          outline: "none",
          width: "100%",
          marginBottom: 8,
    };
  
    return (
          <div style={{ minHeight: "100vh", background: dark, color: "white", fontFamily: "'Inter', system-ui, sans-serif", padding: 16 }}>
            {/* ── Header ── */}
                <div style={{
                    background: "linear-gradient(135deg, #020617 0%, #03152F 40%, #0b1f3a 100%)",
                    padding: "24px 28px",
                    borderRadius: 20,
                    marginBottom: 20,
                    position: "relative",
                    overflow: "hidden",
                    border: "1px solid rgba(59,130,246,0.3)",
          }}>
                        <div style={{ position: "absolute", top: 0, right: 0, width: "50%", height: "100%", background: "radial-gradient(circle at 70% 30%, rgba(56,189,248,0.2), transparent 60%)", pointerEvents: "none" }} />
                        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                                  <div>
                                              <h1 style={{ margin: 0, fontSize: 28, letterSpacing: 3, color: "white", fontWeight: 900 }}>BOURNE SEARCH</h1>h1>
                                              <p style={{ margin: "6px 0 0", color: "#9fb0cf", fontSize: 13, letterSpacing: 1 }}>Connecting Talent. Powering FinTech.</p>p>
                                  </div>div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                              <div style={{ fontSize: 11, color: accent, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Internal Dashboard</div>div>
                                              <div style={{ fontSize: 11, color: synced ? "#4ade80" : "#f87171", display: "flex", alignItems: "center", gap: 6 }}>
                                                            <Icon name={synced ? "cloud" : "wifioff"} size={14} />
                                                {synced ? (lastSaved ? `Saved ${lastSaved}` : "Synced") : "Local only"}
                                              </div>div>
                                  </div>div>
                        </div>div>
                </div>div>
          
            {/* ── Tab Navigation ── */}
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  {([
            { id: "tracker", label: "KPI Tracker", icon: "target" },
            { id: "leaderboard", label: "Leaderboard", icon: "trophy" },
            { id: "settings", label: "Settings", icon: "users" },
                    ] as const).map((item) => (
                      <button
                                    key={item.id}
                                    onClick={() => setTab(item.id)}
                                    style={{
                                                    ...btnBase,
                                                    background: tab === item.id ? accent : "rgba(255,255,255,0.05)",
                                                    color: tab === item.id ? dark : mutedText,
                                                    border: `1px solid ${tab === item.id ? accent : border}`,
                                                    padding: "10px 18px",
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                    }}
                                  >
                                  <Icon name={item.icon} size={15} />
                        {item.label}
                      </button>button>
                    ))}
                </div>div>
          
            {/* ── Tracker Tab ── */}
            {tab === "tracker" && (
                    <div>
                      {/* Score Summary Cards */}
                              <div style={{ display: "grid", gridTemplateColumns: `repeat(${(state.players || []).length}, 1fr)`, gap: 12, marginBottom: 20 }}>
                                {(state.players || []).map((player, idx) => (
                                    <div key={player} style={{
                                                      ...cardStyle,
                                                      background: idx === 0 && sortedPlayers[0] === player
                                                                          ? "linear-gradient(135deg, rgba(56,189,248,0.15), rgba(15,23,42,0.9))"
                                                                          : card,
                                                      border: idx === 0 && sortedPlayers[0] === player
                                                                          ? `1px solid rgba(56,189,248,0.4)`
                                                                          : `1px solid ${border}`,
                                                      textAlign: "center",
                                                      marginBottom: 0,
                                    }}>
                                                    <div style={{ fontSize: 12, color: mutedText, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>{player}</div>div>
                                                    <div style={{ fontSize: 48, fontWeight: 900, color: sortedPlayers[0] === player ? accent : "white", lineHeight: 1 }}>{totals[player] || 0}</div>div>
                                                    <div style={{ fontSize: 11, color: mutedText, marginTop: 4 }}>pts</div>div>
                                    </div>div>
                                  ))}
                              </div>div>
                    
                      {/* KPI Matrix */}
                              <div style={cardStyle}>
                                          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 }}>
                                                        <Icon name="target" className="" style={{ color: accent }} /> KPI Execution Matrix
                                          </h3>h3>
                                          <div style={{ overflowX: "auto" }}>
                                                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                                                        <thead>
                                                                                          <tr>
                                                                                                              <th style={{ textAlign: "left", padding: "8px 12px", color: mutedText, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", borderBottom: `1px solid ${border}` }}>KPI</th>th>
                                                                                                              <th style={{ textAlign: "center", padding: "8px 12px", color: mutedText, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", borderBottom: `1px solid ${border}` }}>Pts</th>th>
                                                                                            {(state.players || []).map((p) => (
                                            <th key={p} style={{ textAlign: "center", padding: "8px 12px", color: accent, fontSize: 13, fontWeight: 800, borderBottom: `1px solid ${border}` }}>{p}</th>th>
                                          ))}
                                                                                            </tr>tr>
                                                                        </thead>thead>
                                                                        <tbody>
                                                                          {(state.activities || []).map((activity) => (
                                          <tr key={activity.key} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                                                                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "white" }}>{activity.label}</td>td>
                                                                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                                                                        <span style={{ background: "rgba(56,189,248,0.15)", color: accent, borderRadius: 8, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{activity.points}</span>span>
                                                                </td>td>
                                            {(state.players || []).map((player) => (
                                                                    <td key={player} style={{ padding: "6px 12px", textAlign: "center" }}>
                                                                                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                                                                                                                          <button
                                                                                                                                                          onClick={() => updateCount(player, activity.key, -1)}
                                                                                                                                                          style={{ ...btnBase, background: "rgba(239,68,68,0.15)", color: "#f87171", padding: "4px 8px", borderRadius: 8 }}
                                                                                                                                                        >
                                                                                                                                                        <Icon name="minus" size={12} />
                                                                                                                            </button>button>
                                                                                                                          <span style={{ fontSize: 18, fontWeight: 800, color: "white", minWidth: 28, textAlign: "center" }}>
                                                                                                                            {state.weeklyCounts?.[player]?.[activity.key] || 0}
                                                                                                                            </span>span>
                                                                                                                          <button
                                                                                                                                                          onClick={() => updateCount(player, activity.key, 1)}
                                                                                                                                                          style={{ ...btnBase, background: "rgba(56,189,248,0.15)", color: accent, padding: "4px 8px", borderRadius: 8 }}
                                                                                                                                                        >
                                                                                                                                                        <Icon name="plus" size={12} />
                                                                                                                            </button>button>
                                                                                                </div>div>
                                                                    </td>td>
                                                                  ))}
                                          </tr>tr>
                                        ))}
                                                                          {/* Totals Row */}
                                                                                          <tr style={{ borderTop: `2px solid ${border}`, background: "rgba(56,189,248,0.05)" }}>
                                                                                                              <td colSpan={2} style={{ padding: "12px", fontWeight: 900, fontSize: 14, color: "white" }}>TOTAL</td>td>
                                                                                            {(state.players || []).map((player) => (
                                            <td key={player} style={{ padding: "12px", textAlign: "center", fontSize: 24, fontWeight: 900, color: accent }}>{totals[player] || 0}</td>td>
                                          ))}
                                                                                            </tr>tr>
                                                                        </tbody>tbody>
                                                        </table>table>
                                          </div>div>
                              </div>div>
                    </div>div>
                )}
          
            {/* ── Leaderboard Tab ── */}
            {tab === "leaderboard" && (
                    <div>
                              <div style={cardStyle}>
                                          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                                                        <Icon name="trophy" /> Leaderboard
                                          </h3>h3>
                                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                            {sortedPlayers.map((player, index) => (
                                      <div key={player} style={{
                                                          borderRadius: 16,
                                                          padding: 20,
                                                          border: `1px solid ${index === 0 ? "rgba(56,189,248,0.4)" : border}`,
                                                          background: index === 0 ? "rgba(56,189,248,0.1)" : "rgba(255,255,255,0.03)",
                                      }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                                                            <div>
                                                                                                  <div style={{ fontSize: 11, color: mutedText, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
                                                                                                    {index === 0 ? "🏆 LEADER" : `RANK #${index + 1}`}
                                                                                                    </div>div>
                                                                                                  <div style={{ fontSize: 28, fontWeight: 900, color: "white" }}>{player}</div>div>
                                                                            </div>div>
                                                                            <div style={{ fontSize: 48, fontWeight: 900, color: accent }}>{totals[player] || 0}</div>div>
                                                        </div>div>
                                                        <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                                                                            <div style={{
                                                              height: "100%",
                                                              borderRadius: 4,
                                                              background: "linear-gradient(90deg, #38bdf8, #6366f1)",
                                                              width: `${((totals[player] || 0) / maxScore) * 100}%`,
                                                              transition: "width 0.5s ease",
                                      }} />
                                                        </div>div>
                                      </div>div>
                                    ))}
                                          </div>div>
                              </div>div>
                    </div>div>
                )}
          
            {/* ── Settings Tab ── */}
            {tab === "settings" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      {/* Players */}
                              <div style={cardStyle}>
                                          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                                                        <Icon name="users" /> Players
                                          </h3>h3>
                                          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                                                        <input
                                                                          value={newPlayer}
                                                                          onChange={(e) => setNewPlayer(e.target.value)}
                                                                          onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                                                                          placeholder="Initials e.g. JW"
                                                                          style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                                                                        />
                                                        <button onClick={addPlayer} style={{ ...btnBase, background: accent, color: dark, whiteSpace: "nowrap" }}>
                                                                        <Icon name="plus" size={14} /> Add
                                                        </button>button>
                                          </div>div>
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                            {(state.players || []).map((player) => (
                                      <span key={player} style={{
                                                          display: "inline-flex", alignItems: "center", gap: 8,
                                                          background: "rgba(255,255,255,0.07)", border: `1px solid ${border}`,
                                                          borderRadius: 20, padding: "6px 14px", fontWeight: 700, fontSize: 13,
                                      }}>
                                        {player}
                                                        <button
                                                                              onClick={() => removePlayer(player)}
                                                                              style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", padding: 0, display: "flex" }}
                                                                            >
                                                                            <Icon name="x" size={13} />
                                                        </button>button>
                                      </span>span>
                                    ))}
                                          </div>div>
                              </div>div>
                    
                      {/* KPIs */}
                              <div style={cardStyle}>
                                          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                                                        <Icon name="target" /> Add KPI
                                          </h3>h3>
                                          <input
                                                          value={newKpi}
                                                          onChange={(e) => setNewKpi(e.target.value)}
                                                          placeholder="KPI name e.g. Client Meetings"
                                                          style={inputStyle}
                                                        />
                                          <div style={{ display: "flex", gap: 8 }}>
                                                        <input
                                                                          value={newKpiPoints}
                                                                          onChange={(e) => setNewKpiPoints(Number(e.target.value))}
                                                                          type="number"
                                                                          min={1}
                                                                          placeholder="Points"
                                                                          style={{ ...inputStyle, marginBottom: 0, width: 80, flex: "none" }}
                                                                        />
                                                        <button onClick={addKpi} style={{ ...btnBase, background: accent, color: dark, flex: 1, justifyContent: "center" }}>
                                                                        <Icon name="plus" size={14} /> Add KPI
                                                        </button>button>
                                          </div>div>
                              </div>div>
                    
                      {/* KPI List */}
                              <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
                                          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800 }}>Current KPIs</h3>h3>
                                          <div style={{ overflowX: "auto" }}>
                                                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                                                        <thead>
                                                                                          <tr>
                                                                                                              <th style={{ textAlign: "left", padding: "8px 12px", color: mutedText, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, borderBottom: `1px solid ${border}` }}>KPI</th>th>
                                                                                                              <th style={{ textAlign: "center", padding: "8px 12px", color: mutedText, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, borderBottom: `1px solid ${border}` }}>Points</th>th>
                                                                                                              <th style={{ borderBottom: `1px solid ${border}` }} />
                                                                                            </tr>tr>
                                                                        </thead>thead>
                                                                        <tbody>
                                                                          {(state.activities || []).map((kpi) => (
                                          <tr key={kpi.key} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                                                                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{kpi.label}</td>td>
                                                                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                                                                        <span style={{ background: "rgba(56,189,248,0.15)", color: accent, borderRadius: 8, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{kpi.points}</span>span>
                                                                </td>td>
                                                                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                                                                        <button
                                                                                                                    onClick={() => removeKpi(kpi.key)}
                                                                                                                    style={{ ...btnBase, background: "rgba(239,68,68,0.15)", color: "#f87171", padding: "4px 10px" }}
                                                                                                                  >
                                                                                                                  <Icon name="x" size={14} /> Remove
                                                                                          </button>button>
                                                                </td>td>
                                          </tr>tr>
                                        ))}
                                                                        </tbody>tbody>
                                                        </table>table>
                                          </div>div>
                              </div>div>
                    
                      {/* Reset */}
                              <div style={{ ...cardStyle, gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                          <div>
                                                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Reset Weekly Counts</div>div>
                                                        <div style={{ fontSize: 12, color: mutedText }}>Clear all scores and start a new week. Cannot be undone.</div>div>
                                          </div>div>
                                          <button onClick={resetWeek} style={{ ...btnBase, background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                                                        <Icon name="reset" size={15} /> Reset Week
                                          </button>button>
                              </div>div>
                    </div>div>
                )}
          </div>div>
        );
}</svg>

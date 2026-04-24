"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase =
      SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null;

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
      return (data?.payload as GameState) ?? null;
}

async function upsertGame(state: GameState) {
      if (!supabase) return;
      await supabase.from("points_games").upsert({
              room_id: roomId,
              payload: state,
              updated_at: new Date().toISOString(),
      });
}

export default function App() {
      const [state, setState] = useState<GameState>(buildDefaultState);
      const [synced, setSynced] = useState(false);
      const [lastSaved, setLastSaved] = useState<string | null>(null);
      const [newPlayer, setNewPlayer] = useState("");
      const [newKpi, setNewKpi] = useState("");
      const [newKpiPoints, setNewKpiPoints] = useState(1);
      const [tab, setTab] = useState<"tracker" | "leaderboard" | "settings">("tracker");

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
                                              try { setState(JSON.parse(saved)); } catch {}
                                }
                    }
          })();
  }, []);

  useEffect(() => {
          localStorage.setItem(localStorageKey, JSON.stringify(state));
          upsertGame(state).then(() => {
                    setSynced(true);
                    setLastSaved(new Date().toLocaleString());
          });
  }, [state]);

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

  const dark = "#020617";
      const cardBg = "rgba(15,23,42,0.9)";
      const borderColor = "rgba(255,255,255,0.08)";
      const accent = "#38bdf8";
      const muted = "#94a3b8";

  const card: React.CSSProperties = {
          background: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: 20,
          padding: 20,
          marginBottom: 16,
  };

  const btn: React.CSSProperties = {
          border: "none",
          cursor: "pointer",
          borderRadius: 12,
          padding: "8px 14px",
          fontWeight: 700,
          fontSize: 13,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
  };

  const inp: React.CSSProperties = {
          background: "rgba(255,255,255,0.06)",
          border: `1px solid ${borderColor}`,
          borderRadius: 12,
          padding: "8px 14px",
          color: "white",
          fontSize: 14,
          outline: "none",
          width: "100%",
          marginBottom: 8,
          boxSizing: "border-box" as const,
  };

  const tabs = [
      { id: "tracker" as const, label: "KPI Tracker" },
      { id: "leaderboard" as const, label: "Leaderboard" },
      { id: "settings" as const, label: "Settings" },
        ];

  return (
          <div style={{ minHeight: "100vh", background: dark, color: "white", fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 1200, margin: "0 auto" }}>
                    <div style={{
                      background: "linear-gradient(135deg, #020617 0%, #03152F 50%, #0b1f3a 100%)",
                      padding: "24px 28px",
                      borderRadius: 20,
                      marginBottom: 20,
                      border: "1px solid rgba(59,130,246,0.3)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
          }}>
                                <div>
                                          <h1 style={{ margin: 0, fontSize: 28, letterSpacing: 3, color: "white", fontWeight: 900 }}>BOURNE SEARCH</h1>h1>
                                          <p style={{ margin: "6px 0 0", color: "#9fb0cf", fontSize: 13, letterSpacing: 1 }}>Connecting Talent. Powering FinTech.</p>p>
                                </div>div>
                            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                      <span style={{ fontSize: 11, color: accent, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Internal Dashboard</span>span>
                                      <span style={{ fontSize: 11, color: synced ? "#4ade80" : "#f87171" }}>
                                          {synced ? (lastSaved ? `Saved ${lastSaved}` : "Synced") : "Local only"}
                                      </span>span>
                            </div>div>
                    </div>div>
          
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    {tabs.map((t) => (
                        <button
                                        key={t.id}
                                        onClick={() => setTab(t.id)}
                                        style={{
                                                          ...btn,
                                                          background: tab === t.id ? accent : "rgba(255,255,255,0.05)",
                                                          color: tab === t.id ? dark : muted,
                                                          border: `1px solid ${tab === t.id ? accent : borderColor}`,
                                                          padding: "10px 20px",
                                        }}
                                      >
                            {t.label}
                        </button>button>
                      ))}
                </div>div>
          
              {tab === "tracker" && (
                      <div>
                                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(state.players?.length || 1, 1)}, 1fr)`, gap: 12, marginBottom: 20 }}>
                                    {(state.players || []).map((player) => (
                                        <div key={player} style={{
                                                            ...card,
                                                            background: sortedPlayers[0] === player
                                                                                  ? "linear-gradient(135deg, rgba(56,189,248,0.15), rgba(15,23,42,0.95))"
                                                                                  : cardBg,
                                                            border: `1px solid ${sortedPlayers[0] === player ? "rgba(56,189,248,0.4)" : borderColor}`,
                                                            textAlign: "center",
                                                            marginBottom: 0,
                                        }}>
                                                        <div style={{ fontSize: 12, color: muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{player}</div>div>
                                                        <div style={{ fontSize: 52, fontWeight: 900, color: sortedPlayers[0] === player ? accent : "white", lineHeight: 1 }}>{totals[player] || 0}</div>div>
                                                        <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>pts</div>div>
                                        </div>div>
                                      ))}
                                </div>div>
                      
                                <div style={card}>
                                            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800 }}>KPI Execution Matrix</h3>h3>
                                            <div style={{ overflowX: "auto" }}>
                                                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                                                          <thead>
                                                                                            <tr>
                                                                                                                <th style={{ textAlign: "left", padding: "8px 12px", color: muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, borderBottom: `1px solid ${borderColor}` }}>KPI</th>th>
                                                                                                                <th style={{ textAlign: "center", padding: "8px 12px", color: muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, borderBottom: `1px solid ${borderColor}` }}>Pts</th>th>
                                                                                                {(state.players || []).map((p) => (
                                                <th key={p} style={{ textAlign: "center", padding: "8px 12px", color: accent, fontSize: 14, fontWeight: 800, borderBottom: `1px solid ${borderColor}` }}>{p}</th>th>
                                              ))}
                                                                                                </tr>tr>
                                                                          </thead>thead>
                                                                          <tbody>
                                                                              {(state.activities || []).map((activity) => (
                                              <tr key={activity.key} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                                                                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{activity.label}</td>td>
                                                                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                                                                            <span style={{ background: "rgba(56,189,248,0.15)", color: accent, borderRadius: 8, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{activity.points}</span>span>
                                                                    </td>td>
                                                  {(state.players || []).map((player) => (
                                                                          <td key={player} style={{ padding: "6px 12px", textAlign: "center" }}>
                                                                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                                                                                                                                <button onClick={() => updateCount(player, activity.key, -1)} style={{ ...btn, background: "rgba(239,68,68,0.15)", color: "#f87171", padding: "4px 10px", borderRadius: 8 }}>-</button>button>
                                                                                                                                <span style={{ fontSize: 18, fontWeight: 800, minWidth: 28, textAlign: "center" }}>{state.weeklyCounts?.[player]?.[activity.key] || 0}</span>span>
                                                                                                                                <button onClick={() => updateCount(player, activity.key, 1)} style={{ ...btn, background: "rgba(56,189,248,0.15)", color: accent, padding: "4px 10px", borderRadius: 8 }}>+</button>button>
                                                                                                        </div>div>
                                                                          </td>td>
                                                                        ))}
                                              </tr>tr>
                                            ))}
                                                                                            <tr style={{ borderTop: `2px solid ${borderColor}`, background: "rgba(56,189,248,0.05)" }}>
                                                                                                                <td colSpan={2} style={{ padding: "12px", fontWeight: 900, fontSize: 14 }}>TOTAL</td>td>
                                                                                                {(state.players || []).map((player) => (
                                                <td key={player} style={{ padding: "12px", textAlign: "center", fontSize: 26, fontWeight: 900, color: accent }}>{totals[player] || 0}</td>td>
                                              ))}
                                                                                                </tr>tr>
                                                                          </tbody>tbody>
                                                          </table>table>
                                            </div>div>
                                </div>div>
                      </div>div>
                )}
          
              {tab === "leaderboard" && (
                      <div style={card}>
                                <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 800 }}>Leaderboard</h3>h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    {sortedPlayers.map((player, index) => (
                                        <div key={player} style={{
                                                            borderRadius: 16,
                                                            padding: 20,
                                                            border: `1px solid ${index === 0 ? "rgba(56,189,248,0.4)" : borderColor}`,
                                                            background: index === 0 ? "rgba(56,189,248,0.1)" : "rgba(255,255,255,0.03)",
                                        }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                                                          <div>
                                                                                              <div style={{ fontSize: 11, color: muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
                                                                                                  {index === 0 ? "LEADER" : `RANK #${index + 1}`}
                                                                                                  </div>div>
                                                                                              <div style={{ fontSize: 28, fontWeight: 900 }}>{player}</div>div>
                                                                          </div>div>
                                                                          <div style={{ fontSize: 48, fontWeight: 900, color: accent }}>{totals[player] || 0}</div>div>
                                                        </div>div>
                                                        <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                                                                          <div style={{
                                                                height: "100%",
                                                                borderRadius: 4,
                                                                background: "linear-gradient(90deg, #38bdf8, #6366f1)",
                                                                width: `${Math.round(((totals[player] || 0) / maxScore) * 100)}%`,
                                                                transition: "width 0.5s ease",
                                        }} />
                                                        </div>div>
                                        </div>div>
                                      ))}
                                </div>div>
                      </div>div>
                )}
          
              {tab === "settings" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div style={card}>
                                            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800 }}>Players</h3>h3>
                                            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                                                          <input value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()} placeholder="Initials e.g. JW" style={{ ...inp, marginBottom: 0, flex: 1 }} />
                                                          <button onClick={addPlayer} style={{ ...btn, background: accent, color: dark }}>Add</button>button>
                                            </div>div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                {(state.players || []).map((player) => (
                                          <span key={player} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.07)", border: `1px solid ${borderColor}`, borderRadius: 20, padding: "6px 14px", fontWeight: 700, fontSize: 13 }}>
                                              {player}
                                                            <button onClick={() => removePlayer(player)} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}>x</button>button>
                                          </span>span>
                                        ))}
                                            </div>div>
                                </div>div>
                      
                                <div style={card}>
                                            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800 }}>Add KPI</h3>h3>
                                            <input value={newKpi} onChange={(e) => setNewKpi(e.target.value)} placeholder="KPI name e.g. Client Meetings" style={inp} />
                                            <div style={{ display: "flex", gap: 8 }}>
                                                          <input value={newKpiPoints} onChange={(e) => setNewKpiPoints(Number(e.target.value))} type="number" min={1} placeholder="Points" style={{ ...inp, marginBottom: 0, width: 90, flex: "none" }} />
                                                          <button onClick={addKpi} style={{ ...btn, background: accent, color: dark, flex: 1, justifyContent: "center" }}>Add KPI</button>button>
                                            </div>div>
                                </div>div>
                      
                                <div style={{ ...card, gridColumn: "1 / -1" }}>
                                            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800 }}>Current KPIs</h3>h3>
                                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                                          <thead>
                                                                          <tr>
                                                                                            <th style={{ textAlign: "left", padding: "8px 12px", color: muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, borderBottom: `1px solid ${borderColor}` }}>KPI</th>th>
                                                                                            <th style={{ textAlign: "center", padding: "8px 12px", color: muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, borderBottom: `1px solid ${borderColor}` }}>Points</th>th>
                                                                                            <th style={{ borderBottom: `1px solid ${borderColor}` }} />
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
                                                                                      <button onClick={() => removeKpi(kpi.key)} style={{ ...btn, background: "rgba(239,68,68,0.15)", color: "#f87171" }}>Remove</button>button>
                                                                </td>td>
                                            </tr>tr>
                                          ))}
                                                          </tbody>tbody>
                                            </table>table>
                                </div>div>
                      
                                <div style={{ ...card, gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                          <div style={{ fontWeight: 700, marginBottom: 4 }}>Reset Weekly Counts</div>div>
                                                          <div style={{ fontSize: 12, color: muted }}>Clear all scores for a new week. Cannot be undone.</div>div>
                                            </div>div>
                                            <button onClick={resetWeek} style={{ ...btn, background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>Reset Week</button>button>
                                </div>div>
                      </div>div>
                )}
          </div>div>
        );
}</div>

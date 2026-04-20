"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { Trophy, Plus, Minus, RotateCcw, Cloud, WifiOff, Settings, CalendarDays, Users, BarChart3 } from "lucide-react";

type Activity = { key: string; label: string; points: number };
type Counts = Record<string, number>;
type DailyRow = { day: string; players: Record<string, number> };
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
const localStorageKey = "points-game-v1";
const roomId = "office-points-game";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

function getDays() {
  return ["Wed", "Thu", "Fri", "Mon", "Tue", "Wed"];
}

function emptyCounts(activities: Activity[]) {
  return Object.fromEntries(activities.map((a) => [a.key, 0]));
}

function makeInitialState(): GameState {
  const activities = defaultActivities;
  const players = defaultPlayers;
  const weeklyCounts = Object.fromEntries(players.map((p) => [p, emptyCounts(activities)]));
  const daily = getDays().map((day) => ({
    day,
    players: Object.fromEntries(players.map((p) => [p, 0])),
  }));

  return {
    roomId,
    title: "Points Game",
    subtitle: "1 week challenge",
    challengeEnds: "Thursday 30th",
    activities,
    players,
    weeklyCounts,
    daily,
    updatedAt: new Date().toISOString(),
  };
}

function scoreFromCounts(counts: Counts, activities: Activity[]) {
  return activities.reduce((sum, a) => sum + (counts[a.key] || 0) * a.points, 0);
}

async function upsertGame(state: GameState) {
  if (!supabase) return;
  const { error } = await supabase.from("points_games").upsert({
    room_id: state.roomId,
    payload: state,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function fetchGame() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("points_games")
    .select("payload")
    .eq("room_id", roomId)
    .maybeSingle();
  if (error) throw error;
  return data?.payload || null;
}

export default function Page() {
  const [state, setState] = useState<GameState>(makeInitialState());
  const [tab, setTab] = useState<"tracker" | "leaderboard" | "daily" | "settings">("tracker");
  const [newPlayer, setNewPlayer] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [lastSaved, setLastSaved] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(localStorageKey) : null;
        const localState = raw ? JSON.parse(raw) : makeInitialState();

        if (supabase) {
          const remote = await fetchGame();
          const initial = remote || localState;
          setState(initial);
          setIsSynced(true);
          if (!remote) await upsertGame(initial);
          setLastSaved(new Date().toLocaleString());
        } else {
          setState(localState);
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(localStorageKey, JSON.stringify(state));
    }
    const id = setTimeout(async () => {
      try {
        if (supabase) {
          await upsertGame({ ...state, updatedAt: new Date().toISOString() });
          setLastSaved(new Date().toLocaleString());
        }
      } catch {}
    }, 250);
    return () => clearTimeout(id);
  }, [state, loading]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("points-game-room")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "points_games", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const nextState = payload.new?.payload as GameState | undefined;
          if (nextState) {
            setState(nextState);
            setLastSaved(new Date().toLocaleString());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const totals = useMemo(
    () =>
      Object.fromEntries(
        state.players.map((player) => [
          player,
          scoreFromCounts(state.weeklyCounts[player] || {}, state.activities),
        ])
      ),
    [state]
  );

  const winner = useMemo(() => {
    const sorted = [...state.players].sort((a, b) => (totals[b] || 0) - (totals[a] || 0));
    if (!sorted.length) return "-";
    if (sorted.length > 1 && totals[sorted[0]] === totals[sorted[1]]) return "Draw";
    return sorted[0];
  }, [state.players, totals]);

  const maxScore = Math.max(1, ...Object.values(totals));

  function updateCount(player: string, key: string, delta: number) {
    setState((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      weeklyCounts: {
        ...prev.weeklyCounts,
        [player]: {
          ...prev.weeklyCounts[player],
          [key]: Math.max(0, (prev.weeklyCounts[player]?.[key] || 0) + delta),
        },
      },
    }));
  }

  function setDailyPoints(index: number, player: string, value: string) {
    const numeric = Math.max(0, Number(value) || 0);
    setState((prev) => {
      const nextDaily = [...prev.daily];
      nextDaily[index] = {
        ...nextDaily[index],
        players: { ...nextDaily[index].players, [player]: numeric },
      };
      return { ...prev, daily: nextDaily, updatedAt: new Date().toISOString() };
    });
  }

  function resetAll() {
    setState(makeInitialState());
  }

  function addPlayer() {
    const trimmed = newPlayer.trim().toUpperCase();
    if (!trimmed || state.players.includes(trimmed)) return;
    setState((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      players: [...prev.players, trimmed],
      weeklyCounts: { ...prev.weeklyCounts, [trimmed]: emptyCounts(prev.activities) },
      daily: prev.daily.map((d) => ({ ...d, players: { ...d.players, [trimmed]: 0 } })),
    }));
    setNewPlayer("");
  }

  function updateActivityPoints(key: string, points: string) {
    const numeric = Math.max(0, Number(points) || 0);
    setState((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      activities: prev.activities.map((a) => (a.key === key ? { ...a, points: numeric } : a)),
    }));
  }

  if (loading) {
    return <main className="shell"><div className="banner">Loading game…</div></main>;
  }

  return (
    <main className="shell">
      <section className="top-note">
        {!isSynced ? (
          <div className="note warning"><WifiOff size={16} /><span>Local mode only. Add your Supabase env keys in Vercel to make it shared.</span></div>
        ) : (
          <div className="note ok"><Cloud size={16} /><span>Shared live mode is on. Room: <strong>{state.roomId}</strong>. Last saved: {lastSaved}</span></div>
        )}
      </section>

      <section className="hero-grid">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="card hero">
            <div className="hero-head">
              <div>
                {!editingTitle ? (
                  <>
                    <div className="eyebrow">Office challenge</div>
                    <h1>{state.title}</h1>
                    <p>{state.subtitle} • Ends {state.challengeEnds}</p>
                  </>
                ) : (
                  <div className="edit-stack">
                    <input value={state.title} onChange={(e) => setState((prev) => ({ ...prev, title: e.target.value }))} />
                    <input value={state.subtitle} onChange={(e) => setState((prev) => ({ ...prev, subtitle: e.target.value }))} />
                    <input value={state.challengeEnds} onChange={(e) => setState((prev) => ({ ...prev, challengeEnds: e.target.value }))} />
                  </div>
                )}
              </div>
              <div className="hero-actions">
                <button className="button secondary" onClick={() => setEditingTitle((v) => !v)}><Settings size={16} />{editingTitle ? "Close" : "Edit"}</button>
                <button className="button secondary" onClick={resetAll}><RotateCcw size={16} />Reset</button>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="card leader-card">
            <div className="leader-top">
              <div className="leader-icon"><Trophy size={24} /></div>
              <div><div className="muted">Current leader</div><div className="leader-name">{winner}</div></div>
            </div>
            <div className="leader-mini-grid">
              {state.players.slice(0, 2).map((player) => (
                <div key={player} className="leader-mini">
                  <div className="muted">{player}</div>
                  <div className="leader-score">{totals[player] || 0}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      <section className="tab-row">
        {[
          ["tracker", "Tracker", <Users key="u" size={16} />],
          ["leaderboard", "Leaderboard", <Trophy key="t" size={16} />],
          ["daily", "Daily", <CalendarDays key="c" size={16} />],
          ["settings", "Settings", <BarChart3 key="b" size={16} />],
        ].map(([key, label, icon]) => (
          <button key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key as any)}>
            {icon}{label}
          </button>
        ))}
      </section>

      {tab === "tracker" && (
        <section className="card section-card">
          <div className="section-title">Weekly tracker</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Points each</th>
                  {state.players.map((player) => <th key={player} className="center">{player}</th>)}
                </tr>
              </thead>
              <tbody>
                {state.activities.map((activity) => (
                  <tr key={activity.key}>
                    <td>{activity.label}</td>
                    <td><span className="pill">{activity.points}</span></td>
                    {state.players.map((player) => (
                      <td key={player}>
                        <div className="counter">
                          <button className="icon-button ghost" onClick={() => updateCount(player, activity.key, -1)}><Minus size={16} /></button>
                          <div className="count-value">{state.weeklyCounts[player]?.[activity.key] || 0}</div>
                          <button className="icon-button" onClick={() => updateCount(player, activity.key, 1)}><Plus size={16} /></button>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td><strong>Total points</strong></td>
                  <td />
                  {state.players.map((player) => <td key={player} className="total-cell">{totals[player] || 0}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "leaderboard" && (
        <section className="leaderboard-grid">
          {[...state.players].sort((a, b) => (totals[b] || 0) - (totals[a] || 0)).map((player, index) => (
            <motion.div key={player} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`card section-card ${index === 0 ? "winner-ring" : ""}`}>
              <div className="rank-row">
                <div><div className="muted">#{index + 1}</div><div className="rank-name">{player}</div></div>
                {index === 0 ? <Trophy size={22} /> : null}
              </div>
              <div className="rank-score">{totals[player] || 0}</div>
              <div className="bar"><div className="bar-fill" style={{ width: `${((totals[player] || 0) / maxScore) * 100}%` }} /></div>
            </motion.div>
          ))}
        </section>
      )}

      {tab === "daily" && (
        <section className="card section-card">
          <div className="section-title">Daily points log</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  {state.players.map((player) => <th key={player}>{player}</th>)}
                </tr>
              </thead>
              <tbody>
                {state.daily.map((row, index) => (
                  <tr key={`${row.day}-${index}`}>
                    <td>{row.day}</td>
                    {state.players.map((player) => (
                      <td key={player}><input className="table-input" type="number" min="0" value={row.players[player] ?? 0} onChange={(e) => setDailyPoints(index, player, e.target.value)} /></td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td><strong>Total</strong></td>
                  {state.players.map((player) => <td key={player}><strong>{state.daily.reduce((sum, row) => sum + (row.players[player] || 0), 0)}</strong></td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "settings" && (
        <section className="settings-grid">
          <div className="card section-card">
            <div className="section-title">Scoring rules</div>
            <div className="settings-list">
              {state.activities.map((activity) => (
                <div key={activity.key} className="settings-row">
                  <div>{activity.label}</div>
                  <input className="settings-input" type="number" min="0" value={activity.points} onChange={(e) => updateActivityPoints(activity.key, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div className="card section-card">
            <div className="section-title">Players</div>
            <div className="player-add">
              <input placeholder="Add initials" value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()} />
              <button className="button" onClick={addPlayer}>Add</button>
            </div>
            <div className="badge-wrap">
              {state.players.map((player) => <span className="badge" key={player}>{player}</span>)}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

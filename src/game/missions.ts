import type { DailyMissionState, DailyMissionsSnapshot, MissionKind } from './types';

const STORAGE_KEY = 'surya_run_daily_missions_v1';

interface MissionTemplate {
  kind: MissionKind;
  title: (target: number) => string;
  target: number;
  reward: number;
}

const MISSION_POOL: MissionTemplate[] = [
  {
    kind: 'distance_total',
    title: (t) => `Cover ${t}m across temple runs`,
    target: 500,
    reward: 200,
  },
  {
    kind: 'distance_single',
    title: (t) => `Sprint ${t}m in a single escape`,
    target: 260,
    reward: 250,
  },
  {
    kind: 'coins_total',
    title: (t) => `Collect ${t} Surya Relics`,
    target: 40,
    reward: 180,
  },
  {
    kind: 'acrobatics',
    title: (t) => `Perform ${t} vaults or slides`,
    target: 14,
    reward: 160,
  },
  {
    kind: 'close_calls',
    title: (t) => `Score ${t} Close Calls or Clean Vaults`,
    target: 4,
    reward: 240,
  },
  {
    kind: 'powerups',
    title: (t) => `Activate ${t} temple power-ups`,
    target: 2,
    reward: 220,
  },
];

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getYesterdayDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hashDateKey(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function generateMissionsForDate(dateKey: string): DailyMissionState[] {
  const seed = hashDateKey(dateKey);
  const poolCopy = [...MISSION_POOL];
  const chosen: MissionTemplate[] = [];

  for (let i = 0; i < 3; i++) {
    const idx = (seed + i * 7 + Math.floor(seed / (i + 3))) % poolCopy.length;
    chosen.push(poolCopy.splice(idx, 1)[0]);
  }

  return chosen.map((tpl, idx) => ({
    id: `${dateKey}_${tpl.kind}_${idx}`,
    kind: tpl.kind,
    title: tpl.title(tpl.target),
    target: tpl.target,
    progress: 0,
    reward: tpl.reward,
    claimed: false,
  }));
}

function saveState(snapshot: DailyMissionsSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage failures
  }
}

export function loadDailyMissionsState(): DailyMissionsSnapshot {
  const today = getTodayDateKey();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyMissionsSnapshot;
      if (parsed && parsed.dateKey === today && Array.isArray(parsed.missions) && parsed.missions.length === 3) {
        return parsed;
      }
      const prevGold = Number(parsed?.vaultGold || 0) || 0;
      const yesterday = getYesterdayDateKey();
      const nextStreak =
        parsed?.dateKey === yesterday
          ? Math.max(1, (Number(parsed?.streakDays || 1) || 1) + 1)
          : 1;
      const fresh: DailyMissionsSnapshot = {
        dateKey: today,
        vaultGold: prevGold,
        streakDays: nextStreak,
        missions: generateMissionsForDate(today),
      };
      saveState(fresh);
      return fresh;
    }
  } catch {
    // Fallback to fresh generation
  }

  const fresh: DailyMissionsSnapshot = {
    dateKey: today,
    vaultGold: 0,
    streakDays: 1,
    missions: generateMissionsForDate(today),
  };
  saveState(fresh);
  return fresh;
}

export interface MissionProgressDelta {
  distanceAdded?: number;
  singleRunDistance?: number;
  coinsAdded?: number;
  acrobaticsAdded?: number;
  closeCallsAdded?: number;
  powerupsAdded?: number;
}

export function recordDailyMissionProgress(
  current: DailyMissionsSnapshot,
  delta: MissionProgressDelta,
): { snapshot: DailyMissionsSnapshot; completedTitle: string } {
  const today = getTodayDateKey();
  const base = current.dateKey === today ? current : loadDailyMissionsState();

  let completedTitle = '';
  const updatedMissions = base.missions.map((m) => {
    const wasDone = m.progress >= m.target;
    let nextProgress = m.progress;

    if (m.kind === 'distance_total' && delta.distanceAdded) {
      nextProgress += delta.distanceAdded;
    } else if (m.kind === 'distance_single' && delta.singleRunDistance !== undefined) {
      nextProgress = Math.max(nextProgress, Math.floor(delta.singleRunDistance));
    } else if (m.kind === 'coins_total' && delta.coinsAdded) {
      nextProgress += delta.coinsAdded;
    } else if (m.kind === 'acrobatics' && delta.acrobaticsAdded) {
      nextProgress += delta.acrobaticsAdded;
    } else if (m.kind === 'close_calls' && delta.closeCallsAdded) {
      nextProgress += delta.closeCallsAdded;
    } else if (m.kind === 'powerups' && delta.powerupsAdded) {
      nextProgress += delta.powerupsAdded;
    }

    nextProgress = Math.min(m.target, Math.floor(nextProgress));
    if (!wasDone && nextProgress >= m.target) {
      completedTitle = m.title;
    }
    return { ...m, progress: nextProgress };
  });

  const nextSnapshot: DailyMissionsSnapshot = {
    ...base,
    vaultGold: base.vaultGold + (delta.coinsAdded || 0),
    missions: updatedMissions,
  };
  saveState(nextSnapshot);
  return { snapshot: nextSnapshot, completedTitle };
}

export function claimDailyMissionReward(
  current: DailyMissionsSnapshot,
  missionId: string,
): DailyMissionsSnapshot {
  let bonus = 0;
  const missions = current.missions.map((m) => {
    if (m.id === missionId && !m.claimed && m.progress >= m.target) {
      bonus = m.reward;
      return { ...m, claimed: true };
    }
    return m;
  });

  if (bonus === 0) return current;
  const next: DailyMissionsSnapshot = {
    ...current,
    vaultGold: current.vaultGold + bonus,
    missions,
  };
  saveState(next);
  return next;
}

export function getTimeUntilResetText(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diffMs = Math.max(0, midnight.getTime() - now.getTime());
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return `${hrs}h ${mins}m`;
}

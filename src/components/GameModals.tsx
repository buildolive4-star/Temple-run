import React, { useRef, useState } from 'react';
import {
  Play,
  RotateCcw,
  Trophy,
  Upload,
  X,
  Loader2,
  Shield,
  Sword,
  Wind,
  ScrollText,
  Crown,
} from 'lucide-react';
import { getTimeUntilResetText } from '../game/missions';
import type { HeroId, HudSnapshot } from '../game/types';
import { TitleSvg } from './TitleSvg';

export interface BundledGlbHeroOption {
  id: string;
  name: string;
  role: string;
  url: string;
  accent: string;
}

interface GameModalsProps {
  hud: HudSnapshot;
  bundledHeroes: readonly BundledGlbHeroOption[];
  autoLoadingHero: boolean;
  onStart: () => void;
  onResume: () => void;
  onReturnTitle: () => void;
  onSelectHero: (hero: Exclude<HeroId, 'custom_glb'>) => void;
  onLoadGlbUrl: (url: string, name: string, uid?: string) => Promise<void>;
  onClaimMission: (missionId: string) => void;
}

const BUILTIN_HEROES: Array<{
  id: Exclude<HeroId, 'custom_glb'>;
  name: string;
  role: string;
  accent: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { id: 'arjun', name: 'Arjun', role: 'Explorer', accent: '#e08233', Icon: Wind },
  { id: 'rudra', name: 'Rudra', role: 'Vanguard', accent: '#f0b840', Icon: Shield },
  { id: 'tara', name: 'Tara', role: 'Acrobat', accent: '#36c4b0', Icon: Sword },
];

export const GameModals: React.FC<GameModalsProps> = ({
  hud,
  bundledHeroes,
  autoLoadingHero,
  onStart,
  onResume,
  onReturnTitle,
  onSelectHero,
  onLoadGlbUrl,
  onClaimMission,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [glbBusyUid, setGlbBusyUid] = useState<string | null>(null);
  const [glbError, setGlbError] = useState('');
  const [missionsOpen, setMissionsOpen] = useState(false);

  if (
    hud.phase === 'playing' ||
    hud.phase === 'intro_cutscene' ||
    hud.phase === 'outro_cutscene'
  ) {
    return null;
  }

  const completedMissionsCount = hud.missions.missions.filter(
    (m) => m.progress >= m.target,
  ).length;
  const claimableCount = hud.missions.missions.filter(
    (m) => m.progress >= m.target && !m.claimed,
  ).length;

  const isBusy = autoLoadingHero || glbBusyUid !== null;

  const handleLocalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setGlbError('');
    setGlbBusyUid('local');
    const objectUrl = URL.createObjectURL(file);
    try {
      const cleanName = file.name.replace(/\.(glb|gltf)$/i, '').slice(0, 22) || 'Custom Hero';
      await onLoadGlbUrl(objectUrl, cleanName, 'local');
    } catch {
      setGlbError('Could not load .GLB model. Try a binary .glb character file.');
    } finally {
      URL.revokeObjectURL(objectUrl);
      setGlbBusyUid(null);
    }
  };

  const handleEquipBundledHero = async (hero: BundledGlbHeroOption) => {
    setGlbError('');
    setGlbBusyUid(hero.id);
    try {
      await onLoadGlbUrl(hero.url, hero.name, hero.id);
    } catch {
      setGlbError(`Could not load ${hero.name} 3D model.`);
    } finally {
      setGlbBusyUid(null);
    }
  };

  if (hud.phase === 'title') {
    return (
      <div className="pointer-events-none fixed inset-0 z-10 flex flex-col items-center justify-between px-4 py-5 sm:py-8">
        {/* Top Title Lockup & Unboxed Record Metadata */}
        <div className="pointer-events-auto flex flex-col items-center text-center mt-1">
          <TitleSvg />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold tracking-wide text-[#e9d8b4] tabular-nums">
            {hud.bestScore > 0 && (
              <>
                <span className="inline-flex items-center gap-1.5 text-[#f4cf75]">
                  <Trophy className="h-3.5 w-3.5" />
                  Best {hud.bestScore.toLocaleString()} · {hud.bestDistance}m
                </span>
                <span className="text-[#8d7f66]" aria-hidden="true">·</span>
              </>
            )}
            <span>Vault {hud.missions.vaultGold.toLocaleString()} Gold</span>
            <span className="text-[#8d7f66]" aria-hidden="true">·</span>
            <span>Day {hud.missions.streakDays} Streak</span>
            {hud.heroId === 'custom_glb' && hud.customHeroName && (
              <>
                <span className="text-[#8d7f66]" aria-hidden="true">·</span>
                <span className="text-[#ffe396]">Hero: {hud.customHeroName}</span>
              </>
            )}
          </div>
        </div>

        {/* Bottom Hero Switcher (Bundled 3D GLB Warriors + Temple Heroes), Daily Trials & Start */}
        <div className="pointer-events-auto flex w-full max-w-3xl flex-col items-center gap-2.5 mb-1">
          <div className="flex w-full flex-col gap-1.5 rounded-xl border border-[#d49a42]/40 bg-[#0d151a]/92 p-2 shadow-2xl">
            {/* Row 1: 4 Pre-Bundled 3D Warrior GLB Heroes */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {bundledHeroes.map((hero, idx) => {
                const active = hud.heroId === 'custom_glb' && hud.customHeroUid === hero.id;
                const loadingThis =
                  glbBusyUid === hero.id || (autoLoadingHero && idx === 0);
                return (
                  <button
                    key={hero.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleEquipBundledHero(hero)}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors cursor-pointer disabled:opacity-70 whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-[#ffe28a] bg-[#2a2114] text-[#fff6dc]'
                        : 'border-[#d49a42]/30 bg-[#142027] text-[#dfcfb0] hover:border-[#ffe28a]/75'
                    }`}
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${hero.accent}24`, color: hero.accent }}
                    >
                      {loadingThis ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Crown className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="leading-tight">
                      <span className="block text-xs font-extrabold tracking-wide">
                        {hero.name}
                      </span>
                      <span className="block text-[10px] font-medium opacity-75">
                        {loadingThis ? 'Loading 3D...' : hero.role}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Row 2: Temple Guardians, Custom .GLB File Loader & Daily Trials */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {BUILTIN_HEROES.map(({ id, name, role, accent, Icon }) => {
                const active = hud.heroId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setGlbError('');
                      onSelectHero(id);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-[#ffe28a] bg-[#2a2114] text-[#fff6dc]'
                        : 'border-[#d49a42]/25 bg-[#142027] text-[#cbbda0] hover:border-[#d49a42]/70 hover:text-[#fff6dc]'
                    }`}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded"
                      style={{ backgroundColor: `${accent}26`, color: accent }}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="text-xs font-bold tracking-wide">{name}</span>
                    <span className="text-[10px] opacity-70 hidden sm:inline">· {role}</span>
                  </button>
                );
              })}

              <input
                ref={fileInputRef}
                type="file"
                accept=".glb,.gltf"
                onChange={handleLocalFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold tracking-wide transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 ${
                  hud.heroId === 'custom_glb' && hud.customHeroUid === 'local'
                    ? 'border-[#7ee7d5] bg-[#142c2a] text-[#dffcf6]'
                    : 'border-[#d49a42]/35 bg-[#142027] text-[#e4d5b7] hover:border-[#ffe28a]'
                }`}
                title="Load a custom .GLB character from your device"
              >
                {glbBusyUid === 'local' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                <span>Custom .GLB</span>
              </button>

              <button
                type="button"
                onClick={() => setMissionsOpen(true)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold tracking-wide transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  claimableCount > 0
                    ? 'border-[#f5c249] bg-[#36260b] text-[#ffe187]'
                    : 'border-[#d49a42]/35 bg-[#142027] text-[#e4d5b7] hover:border-[#ffe28a]'
                }`}
              >
                <ScrollText className="h-3.5 w-3.5" />
                <span className="tabular-nums">
                  {claimableCount > 0
                    ? `Claim ${claimableCount} Trial`
                    : `Daily Trials (${completedMissionsCount}/3)`}
                </span>
              </button>
            </div>
          </div>

          {glbError && (
            <div className="rounded-md border border-[#ff7e5f]/55 bg-[#291311]/95 px-3 py-1 text-xs font-semibold text-[#ffb9a8]">
              {glbError}
            </div>
          )}

          <button
            type="button"
            onClick={onStart}
            className="group flex items-center gap-3 rounded-lg border-2 border-[#ffe28a] bg-[#cf7a1d] px-10 py-3.5 text-lg font-black uppercase tracking-[0.18em] text-[#fff8e6] shadow-2xl transition-transform hover:scale-[1.03] hover:bg-[#e28923] active:scale-[0.98] cursor-pointer whitespace-nowrap"
          >
            <Play className="h-5 w-5 fill-current" />
            <span>Start Run</span>
          </button>

          <p className="rounded-md bg-[#0e161b]/88 px-3.5 py-1.5 text-center text-xs font-medium tracking-wide text-[#d8cbb0]">
            A / D or ← / → Lane · W / ↑ / Space Jump · S / ↓ Slide · Swipe on Touch · Esc Pause
          </p>
        </div>

        {/* Daily Trials Modal */}
        {missionsOpen && (
          <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[#080d11]/82 p-4">
            <div className="w-full max-w-lg rounded-xl border border-[#d49a42]/60 bg-[#10191f] p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-[#d49a42]/25 pb-3.5">
                <div>
                  <h3 className="font-display text-lg font-bold tracking-wide text-[#ffe396]">
                    Daily Temple Trials
                  </h3>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-[#b4a78c] tabular-nums">
                    <span>Vault {hud.missions.vaultGold.toLocaleString()} Gold</span>
                    <span aria-hidden="true">·</span>
                    <span>Day {hud.missions.streakDays} Streak</span>
                    <span aria-hidden="true">·</span>
                    <span>Resets in {getTimeUntilResetText()}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMissionsOpen(false)}
                  aria-label="Close Daily Trials"
                  className="rounded-lg border border-[#d49a42]/35 bg-[#17232b] p-1.5 text-[#d8cbb0] hover:text-[#ffe396] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-col divide-y divide-[#d49a42]/18">
                {hud.missions.missions.map((m) => {
                  const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
                  const done = m.progress >= m.target;
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-4 py-3.5 first:pt-1 last:pb-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-bold text-[#f6eedc]">{m.title}</span>
                          <span className="shrink-0 text-xs font-bold text-[#f4cf75] tabular-nums">
                            {m.progress} / {m.target}
                          </span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#1a262e]">
                          <div
                            className={`h-full transition-all ${done ? 'bg-[#5cf2c2]' : 'bg-[#e28923]'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="mt-1.5 text-xs text-[#9e9278] tabular-nums">
                          Reward: +{m.reward} Gold
                        </div>
                      </div>

                      {m.claimed ? (
                        <span className="shrink-0 text-xs font-bold text-[#5cf2c2]">Claimed</span>
                      ) : done ? (
                        <button
                          type="button"
                          onClick={() => onClaimMission(m.id)}
                          className="shrink-0 rounded-lg border border-[#ffe28a] bg-[#cf7a1d] px-3.5 py-2 text-xs font-extrabold tracking-wide text-[#fff8e6] hover:bg-[#e28923] cursor-pointer whitespace-nowrap"
                        >
                          Claim +{m.reward}
                        </button>
                      ) : (
                        <span className="shrink-0 text-xs font-semibold text-[#8c816b] tabular-nums">
                          {pct}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (hud.phase === 'paused') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#090e12]/72 p-4">
        <div className="w-full max-w-sm rounded-xl border border-[#d49a42]/60 bg-[#121c22] p-6 text-center shadow-2xl">
          <h2 className="font-display text-2xl font-bold tracking-wider text-[#ffe396]">
            Paused
          </h2>
          <p className="mt-1 text-xs tracking-wide text-[#b4a78c] tabular-nums">
            Temple Run Halted at {hud.distance}m
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={onResume}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#ffe28a]/80 bg-[#cf7a1d] px-5 py-3 text-sm font-extrabold tracking-wide text-[#fff8e6] transition-colors hover:bg-[#e28923] cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              Resume Run
            </button>
            <button
              type="button"
              onClick={onStart}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#d49a42]/45 bg-[#1a262e] px-5 py-2.5 text-sm font-bold tracking-wide text-[#f6eedc] transition-colors hover:border-[#f3b63f] cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              Restart
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="rounded-lg border border-transparent px-5 py-2 text-xs font-bold tracking-wide text-[#b4a78c] transition-colors hover:text-[#ffe396] cursor-pointer"
            >
              Return to Gate
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Game Over Modal with Inline Daily Trials Progress
  const isNewBest = hud.score > 0 && hud.score >= hud.bestScore;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#090e12]/78 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-xl border border-[#d49a42]/65 bg-[#121c22] p-6 text-center shadow-2xl">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff8d63]">
          {hud.deathReason || 'Run Ended'}
        </div>
        <h2 className="font-display mt-1 text-3xl font-bold tracking-wide text-[#ffe396]">
          Run Complete
        </h2>

        {isNewBest && (
          <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-[#ffd76b]">
            <Trophy className="h-3.5 w-3.5" />
            <span>New High Score</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3 border-y border-[#d49a42]/25 py-3.5">
          <div>
            <div className="text-[11px] font-semibold text-[#a79a80]">Score</div>
            <div className="tabular-nums mt-0.5 text-xl font-black text-[#ffe396]">
              {hud.score.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#a79a80]">Distance</div>
            <div className="tabular-nums mt-0.5 text-xl font-black text-[#f6eedc]">
              {hud.distance}m
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#a79a80]">Relics</div>
            <div className="tabular-nums mt-0.5 text-xl font-black text-[#f3b63f]">
              {hud.coins}
            </div>
          </div>
        </div>

        <div className="mt-2.5 text-xs font-medium text-[#9e9278] tabular-nums">
          Close Calls: {hud.closeCalls} · Best: {hud.bestScore.toLocaleString()} ({hud.bestDistance}m) · Vault: {hud.missions.vaultGold.toLocaleString()} Gold
        </div>

        {/* Daily Trials Progress Section */}
        {hud.missions.missions.length > 0 && (
          <div className="mt-4 text-left">
            <div className="flex items-center justify-between text-xs font-bold text-[#d8cbb0]">
              <span>Daily Temple Trials</span>
              <span className="text-[#9e9278] tabular-nums">
                {completedMissionsCount}/3 Complete
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {hud.missions.missions.map((m) => {
                const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
                const done = m.progress >= m.target;
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 py-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="truncate font-semibold text-[#e8dcc2]">{m.title}</span>
                        <span className="shrink-0 font-bold text-[#f4cf75] tabular-nums">
                          {m.progress}/{m.target}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#1b2730]">
                        <div
                          className={`h-full ${done ? 'bg-[#5cf2c2]' : 'bg-[#e28923]'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    {done && !m.claimed ? (
                      <button
                        type="button"
                        onClick={() => onClaimMission(m.id)}
                        className="shrink-0 rounded-md border border-[#ffe28a] bg-[#cf7a1d] px-2.5 py-1 text-[11px] font-extrabold text-[#fff8e6] hover:bg-[#e28923] cursor-pointer whitespace-nowrap"
                      >
                        Claim +{m.reward}
                      </button>
                    ) : m.claimed ? (
                      <span className="shrink-0 text-[11px] font-bold text-[#5cf2c2]">Claimed</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onStart}
            className="flex items-center justify-center gap-2 rounded-lg border border-[#ffe28a]/85 bg-[#cf7a1d] px-6 py-3.5 text-base font-black uppercase tracking-[0.16em] text-[#fff8e6] transition-colors hover:bg-[#e28923] cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            Play Again
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="rounded-lg px-5 py-2 text-xs font-bold tracking-wide text-[#b4a78c] transition-colors hover:text-[#ffe396] cursor-pointer"
          >
            Temple Gate
          </button>
        </div>
      </div>
    </div>
  );
};

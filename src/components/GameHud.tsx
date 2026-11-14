import React from 'react';
import {
  Pause,
  Play,
  Volume2,
  VolumeX,
  Shield,
  Magnet,
  Flame,
  FastForward,
  CheckCircle2,
} from 'lucide-react';
import type { HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onSkipCutscene: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  muted,
  onToggleMute,
  onTogglePause,
  onSkipCutscene,
}) => {
  const isCutscene = hud.phase === 'intro_cutscene' || hud.phase === 'outro_cutscene';

  if (isCutscene) {
    return (
      <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between">
        {/* Top Letterbox Bar */}
        <div className="pointer-events-auto flex h-[11vh] min-h-[58px] items-center justify-between bg-[#06090c] px-5 sm:px-8 border-b border-[#d49a42]/25">
          <div className="font-display text-xs sm:text-sm font-bold uppercase tracking-[0.22em] text-[#f3cf78]">
            {hud.cutsceneLabel}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d49a42]/35 bg-[#11191f] text-[#f6eedc] transition-colors hover:border-[#f3b63f] cursor-pointer"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onSkipCutscene}
              className="flex items-center gap-1.5 rounded-lg border border-[#d49a42]/50 bg-[#152028] px-3.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#ffe396] transition-colors hover:border-[#ffe28a] hover:bg-[#1f2e39] cursor-pointer whitespace-nowrap"
            >
              <span>Skip</span>
              <FastForward className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Bottom Letterbox Bar with Narrative Subtitle & Progress */}
        <div className="relative flex h-[13vh] min-h-[72px] flex-col items-center justify-center bg-[#06090c] px-6 text-center border-t border-[#d49a42]/25">
          <div
            className="absolute left-0 top-0 h-[2px] bg-[#f3b63f]"
            style={{ width: `${Math.min(100, Math.round(hud.cutsceneProgress * 100))}%` }}
          />
          <p className="max-w-2xl text-sm sm:text-base font-semibold tracking-wide text-[#f6eedc]">
            {hud.cutsceneCaption}
          </p>
          <span className="mt-1 text-[11px] font-semibold text-[#9e9278]">
            Press Space or Click anywhere to skip
          </span>
        </div>
      </div>
    );
  }

  const showActiveBuffs =
    hud.powerups.shield ||
    hud.powerups.magnetRemaining > 0 ||
    hud.powerups.boostRemaining > 0;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Perimeter Row */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Score, Distance, Multiplier & Callouts */}
        {hud.phase !== 'title' ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-3 rounded-lg border border-[#d49a42]/45 bg-[#10181d]/90 px-3.5 py-2 shadow-lg">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c7b38d]">
                  Score
                </div>
                <div className="tabular-nums text-2xl font-black leading-none text-[#ffe396]">
                  {hud.score.toLocaleString()}
                </div>
              </div>
              <div className="h-7 w-px bg-[#d49a42]/30" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c7b38d]">
                  Dist
                </div>
                <div className="tabular-nums text-lg font-extrabold leading-none text-[#f6eedc]">
                  {hud.distance}m
                </div>
              </div>
              {hud.multiplier > 1 && (
                <span className="ml-1 text-xs font-black text-[#ffd262] tabular-nums">
                  · x{hud.multiplier}
                </span>
              )}
            </div>

            {hud.guardianThreat > 0.76 && hud.phase === 'playing' && (
              <div className="rounded border border-[#ff5d2e]/70 bg-[#2b120c]/92 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff936b]">
                Guardian Close Behind
              </div>
            )}

            {hud.calloutText && hud.phase === 'playing' && (
              <div
                key={hud.calloutKey}
                className="rounded border border-[#f5c249]/65 bg-[#2a1d09]/92 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#ffe187] tabular-nums"
              >
                {hud.calloutText}
              </div>
            )}

            {hud.newlyCompletedMission && hud.phase === 'playing' && (
              <div className="flex items-center gap-2 rounded border border-[#5cf2c2]/65 bg-[#0f2622]/94 px-3 py-1.5 text-xs font-bold text-[#9cfbe0]">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#5cf2c2]" />
                <span>Trial Complete: {hud.newlyCompletedMission}</span>
              </div>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* Top-Right: Gold Coins + Audio + Pause */}
        <div className="pointer-events-auto flex items-center gap-2">
          {hud.phase !== 'title' && (
            <div className="flex items-center gap-2 rounded-lg border border-[#d49a42]/45 bg-[#10181d]/90 px-3 py-2 shadow-lg">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <polygon
                  points="12,2 19,5 22,12 19,19 12,22 5,19 2,12 5,5"
                  fill="#f3b63f"
                  stroke="#ffe694"
                  strokeWidth="1.5"
                />
                <circle cx="12" cy="12" r="4" fill="#9c5a12" />
              </svg>
              <span className="tabular-nums text-lg font-black leading-none text-[#ffe396]">
                {hud.coins}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#d49a42]/45 bg-[#10181d]/90 text-[#f6eedc] transition-colors hover:border-[#f3b63f] hover:text-[#ffe396] cursor-pointer"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {(hud.phase === 'playing' || hud.phase === 'paused') && (
            <button
              type="button"
              onClick={onTogglePause}
              aria-label={hud.phase === 'paused' ? 'Resume game' : 'Pause game'}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#d49a42]/45 bg-[#10181d]/90 text-[#f6eedc] transition-colors hover:border-[#f3b63f] hover:text-[#ffe396] cursor-pointer"
            >
              {hud.phase === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Bottom Active Power-Up Strip */}
      {hud.phase === 'playing' && showActiveBuffs && (
        <div className="mx-auto flex items-center gap-3 rounded-lg border border-[#d49a42]/45 bg-[#10181d]/90 px-3.5 py-2 shadow-lg">
          {hud.powerups.shield && (
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5cf2c2]">
              <Shield className="h-4 w-4" />
              <span>Jade Shield</span>
            </div>
          )}

          {hud.powerups.magnetRemaining > 0 && (
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#ff7387]">
              <Magnet className="h-4 w-4" />
              <div className="h-1.5 w-16 overflow-hidden rounded bg-[#2a1820]">
                <div
                  className="h-full bg-[#ff4961]"
                  style={{
                    width: `${Math.min(100, (hud.powerups.magnetRemaining / hud.powerups.magnetDuration) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {hud.powerups.boostRemaining > 0 && (
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#ffc54d]">
              <Flame className="h-4 w-4" />
              <div className="h-1.5 w-16 overflow-hidden rounded bg-[#2c210f]">
                <div
                  className="h-full bg-[#ffb72b]"
                  style={{
                    width: `${Math.min(100, (hud.powerups.boostRemaining / hud.powerups.boostDuration) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GameModals } from './components/GameModals';
import { soundSynth } from './game/audio';
import { RunnerEngine } from './game/RunnerEngine';
import { INITIAL_HUD, type HeroId, type HudSnapshot } from './game/types';

export const BUNDLED_GLB_HEROES = [
  {
    id: 'sword_warrior',
    name: 'Sword Warrior',
    role: 'Blade Runner',
    url: '/models/hero_sword_warrior.glb',
    accent: '#38bdf8',
  },
  {
    id: 'elite_soldier',
    name: 'Elite Soldier',
    role: 'Sci-Fi Vanguard',
    url: '/models/hero_elite_soldier.glb',
    accent: '#06b6d4',
  },
  {
    id: 'cyborg_xbot',
    name: 'Cyborg X-Bot',
    role: 'Android Runner',
    url: '/models/hero_cyborg_xbot.glb',
    accent: '#a855f7',
  },
  {
    id: 'indian_warrior',
    name: 'Surya Warrior',
    role: 'Ancient Champion',
    url: '/models/hero_indian_warrior.glb',
    accent: '#f59e0b',
  },
  {
    id: 'shadow_assassin',
    name: 'Shadow Rogue',
    role: 'Temple Assassin',
    url: '/models/hero_shadow_assassin.glb',
    accent: '#a78bfa',
  },
  {
    id: 'armored_king',
    name: 'Armored King',
    role: 'Royal Vanguard',
    url: '/models/hero_armored_king.glb',
    accent: '#f43f5e',
  },
] as const;

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RunnerEngine | null>(null);
  const userPickedHeroRef = useRef(false);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState<boolean>(() => soundSynth.isMuted());
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let timer: number;
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 22) + 12;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        timer = window.setTimeout(() => {
          setIsInitializing(false);
        }, 350);
      }
      setLoadingProgress(progress);
    }, 180);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new RunnerEngine(mount, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    const defaultHero = BUNDLED_GLB_HEROES[0];
    engine
      .loadCustomGlbCharacter(defaultHero.url, defaultHero.name, defaultHero.id)
      .catch(() => {
        // Fallback smoothly if needed
      });

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [isInitializing]);

  const handleStart = useCallback(() => {
    engineRef.current?.startNewRun();
  }, []);

  const handleTogglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleReturnTitle = useCallback(() => {
    engineRef.current?.returnToTitle();
  }, []);

  const handleToggleMute = useCallback(() => {
    const next = !soundSynth.isMuted();
    soundSynth.setMuted(next);
    setMuted(next);
  }, []);

  const handleSelectHero = useCallback((hero: Exclude<HeroId, 'custom_glb'>) => {
    userPickedHeroRef.current = true;
    engineRef.current?.setHero(hero);
  }, []);

  const handleLoadGlbUrl = useCallback(async (url: string, name: string, uid = '') => {
    userPickedHeroRef.current = true;
    if (!engineRef.current) return;
    await engineRef.current.loadCustomGlbCharacter(url, name, uid);
  }, []);

  const handleSkipCutscene = useCallback(() => {
    engineRef.current?.skipCutscene();
  }, []);

  const handleClaimMission = useCallback((missionId: string) => {
    engineRef.current?.claimMission(missionId);
  }, []);

  if (isInitializing) {
    return (
      <div className="relative flex h-screen w-screen flex-col items-center justify-center bg-[#070b0e] px-4 text-[#f6eedc]">
        <div className="w-full max-w-sm rounded-2xl border border-[#d49a42]/40 bg-[#101920]/95 p-8 text-center shadow-2xl backdrop-blur-md">
          <div className="font-display text-2xl font-black tracking-widest text-[#ffe396]">
            SURYA RUN
          </div>
          <div className="mt-1 text-xs font-semibold tracking-wider text-[#b4a78c]">
            TEMPLE ESCAPE 3D
          </div>

          <div className="mt-8">
            <div className="flex justify-between text-xs font-bold text-[#e2cfab]">
              <span>Loading 3D Engine & Assets</span>
              <span className="tabular-nums text-[#ffe396]">{loadingProgress}%</span>
            </div>
            <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-[#17232b] p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#cf7a1d] to-[#ffe28a] transition-all duration-200"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>

          <p className="mt-6 text-[11px] font-medium text-[#8d8067]">
            Preparing WebGL PBR Shaders, Audio Synth & GLB Character Rigs...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0e171d]">
      {/* Isolated WebGL canvas mount */}
      <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

      <GameHud
        hud={hud}
        muted={muted}
        onToggleMute={handleToggleMute}
        onTogglePause={handleTogglePause}
        onSkipCutscene={handleSkipCutscene}
      />

      <GameModals
        hud={hud}
        bundledHeroes={BUNDLED_GLB_HEROES}
        autoLoadingHero={false}
        onStart={handleStart}
        onResume={handleTogglePause}
        onReturnTitle={handleReturnTitle}
        onSelectHero={handleSelectHero}
        onLoadGlbUrl={handleLoadGlbUrl}
        onClaimMission={handleClaimMission}
      />
    </div>
  );
}

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
  const [autoLoadingHero, setAutoLoadingHero] = useState(true);

  useEffect(() => {
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
        // Fallback smoothly to sculpted temple explorer if needed
      })
      .finally(() => {
        setAutoLoadingHero(false);
      });

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

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

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0e171d]">
      {/* Isolated WebGL canvas mount — React HUD state never tears down the engine */}
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
        autoLoadingHero={autoLoadingHero && !userPickedHeroRef.current}
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

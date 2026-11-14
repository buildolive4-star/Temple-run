export type GamePhase =
  | 'title'
  | 'intro_cutscene'
  | 'playing'
  | 'paused'
  | 'outro_cutscene'
  | 'gameover';

export type HeroId = 'arjun' | 'rudra' | 'tara' | 'custom_glb';

export type PowerupKind = 'shield' | 'magnet' | 'boost';

export type ObstacleKind =
  | 'low_barrier'   // Jump over
  | 'high_arch'     // Slide under
  | 'monolith'      // Dodge left/right
  | 'boulder'       // Rolling stone sphere in a lane
  | 'chakra_trap';  // Spinning bronze blade wheel (dodge or jump)

export type MissionKind =
  | 'distance_total'
  | 'distance_single'
  | 'coins_total'
  | 'acrobatics'
  | 'close_calls'
  | 'powerups';

export interface DailyMissionState {
  id: string;
  kind: MissionKind;
  title: string;
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
}

export interface DailyMissionsSnapshot {
  dateKey: string;
  vaultGold: number;
  streakDays: number;
  missions: DailyMissionState[];
}

export interface ActivePowerups {
  shield: boolean;
  magnetRemaining: number;
  magnetDuration: number;
  boostRemaining: number;
  boostDuration: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  heroId: HeroId;
  customHeroName: string;
  customHeroUid: string;
  distance: number;
  score: number;
  coins: number;
  bestScore: number;
  bestDistance: number;
  multiplier: number;
  speedKmh: number;
  guardianThreat: number;
  closeCalls: number;
  calloutText: string;
  calloutKey: number;
  cutsceneLabel: string;
  cutsceneCaption: string;
  cutsceneProgress: number;
  newlyCompletedMission: string;
  missions: DailyMissionsSnapshot;
  powerups: ActivePowerups;
  deathReason: string;
}

export const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  heroId: 'arjun',
  customHeroName: '',
  customHeroUid: '',
  distance: 0,
  score: 0,
  coins: 0,
  bestScore: 0,
  bestDistance: 0,
  multiplier: 1,
  speedKmh: 0,
  guardianThreat: 0.25,
  closeCalls: 0,
  calloutText: '',
  calloutKey: 0,
  cutsceneLabel: '',
  cutsceneCaption: '',
  cutsceneProgress: 0,
  newlyCompletedMission: '',
  missions: {
    dateKey: '',
    vaultGold: 0,
    streakDays: 1,
    missions: [],
  },
  powerups: {
    shield: false,
    magnetRemaining: 0,
    magnetDuration: 9,
    boostRemaining: 0,
    boostDuration: 5.5,
  },
  deathReason: '',
};

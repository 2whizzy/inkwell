import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { LEVEL_ORDER } from './curriculum'
import type { LevelOverride } from './types'

export interface LevelResult {
  stars: number
  bestAvgMs: number
}

interface MathState {
  stars: Record<string, LevelResult>
  coins: number
  theme: 'day' | 'space'
  sound: boolean
  /** Parent-tuned per-level variables, keyed by level id. */
  overrides: Record<string, LevelOverride>
  completeLevel: (levelId: string, stars: number, avgMs: number, coinsEarned: number) => void
  toggleTheme: () => void
  toggleSound: () => void
  setOverride: (levelId: string, patch: LevelOverride) => void
  resetOverride: (levelId: string) => void
  resetAllOverrides: () => void
}

export const useMathStore = create<MathState>()(
  persist(
    (set) => ({
      stars: {},
      coins: 0,
      theme: 'day',
      sound: true,
      overrides: {},
      completeLevel: (levelId, stars, avgMs, coinsEarned) =>
        set((s) => {
          const prev = s.stars[levelId]
          return {
            coins: s.coins + coinsEarned,
            stars: {
              ...s.stars,
              [levelId]: {
                stars: Math.max(prev?.stars ?? 0, stars),
                bestAvgMs: Math.min(prev?.bestAvgMs ?? Infinity, avgMs),
              },
            },
          }
        }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'day' ? 'space' : 'day' })),
      toggleSound: () => set((s) => ({ sound: !s.sound })),
      setOverride: (levelId, patch) =>
        set((s) => ({
          overrides: { ...s.overrides, [levelId]: { ...s.overrides[levelId], ...patch } },
        })),
      resetOverride: (levelId) =>
        set((s) => {
          const next = { ...s.overrides }
          delete next[levelId]
          return { overrides: next }
        }),
      resetAllOverrides: () => set({ overrides: {} }),
    }),
    { name: 'mental-math-progress' },
  ),
)

/** A level is unlocked when every earlier level in the flat order has been cleared. */
export function isUnlocked(levelId: string, stars: Record<string, LevelResult>): boolean {
  const idx = LEVEL_ORDER.indexOf(levelId)
  if (idx <= 0) return true
  return LEVEL_ORDER.slice(0, idx).every((id) => (stars[id]?.stars ?? 0) > 0)
}

/** The first not-yet-cleared unlocked level — where the mascot hangs out. */
export function activeLevelId(stars: Record<string, LevelResult>): string | null {
  return LEVEL_ORDER.find((id) => (stars[id]?.stars ?? 0) === 0) ?? null
}

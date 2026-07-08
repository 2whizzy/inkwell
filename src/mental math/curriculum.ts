import type { LevelDef, LevelOverride, Problem, WorldDef } from './types'

const ri = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

// ---------- World 1: Left-to-Right Addition ----------

function genAddNoOverlap(): Problem {
  const [a, b] = pick([
    () => [ri(1, 9) * 100, ri(11, 99)],
    () => [ri(1, 9) * 1000, ri(11, 99)],
    () => [ri(1, 9) * 1000 + ri(1, 9) * 100, ri(11, 99)],
  ])()
  return { display: `${a} + ${b}`, answer: String(a + b) }
}

function genAddCarry(): Problem {
  const kind = ri(0, 2)
  let a: number, b: number
  if (kind === 0) {
    // tens carry: 70 + 60
    const x = ri(5, 9), y = ri(11 - x, 9)
    a = x * 10; b = y * 10
  } else if (kind === 1) {
    // hundreds carry: 800 + 400
    const x = ri(5, 9), y = ri(11 - x, 9)
    a = x * 100; b = y * 100
  } else {
    // units carry, no tens carry: 47 + 38
    const u1 = ri(5, 9), u2 = ri(11 - u1, 9)
    const t1 = ri(1, 4), t2 = ri(1, 8 - t1)
    a = t1 * 10 + u1; b = t2 * 10 + u2
  }
  return { display: `${a} + ${b}`, answer: String(a + b) }
}

function genAddAudio(): Problem {
  const p = Math.random() < 0.5 ? genAddNoOverlap() : genAddCarry()
  return { ...p, speech: p.display.replace('+', 'plus') }
}

// ---------- World 2: Power of 11 ----------

function genEleven(noCarry: boolean): Problem {
  let t = ri(1, 9), u = ri(0, 9)
  if (noCarry) { t = ri(1, 8); u = ri(0, 9 - t) }
  else if (t + u <= 9) { u = ri(10 - t > 9 ? 9 : 10 - t, 9) } // force a carry
  const n = t * 10 + u
  return { display: `${n} × 11`, answer: String(n * 11) }
}

function genElevenSplit(): Problem {
  const t = ri(1, 8), u = ri(1, 9 - t)
  const n = t * 10 + u
  return {
    display: `${n} × 11`,
    answer: String(n * 11),
    split: { lead: String(t), middle: String(t + u), tail: String(u) },
  }
}

function genElevenThreeDigit(): Problem {
  // Adjacent digit sums stay ≤ 9 so the cascade never carries (matches the taught example).
  const a = ri(1, 8), b = ri(0, 9 - a), c = ri(0, 9 - b)
  const n = a * 100 + b * 10 + c
  return { display: `${n} × 11`, answer: String(n * 11) }
}

// ---------- World 3: Squaring 5s ----------

function genSquare5(threeDigit = false): Problem {
  const t = threeDigit ? ri(10, 30) : ri(1, 9)
  const n = t * 10 + 5
  return { display: `${n}²`, speech: `${n} squared`, answer: String(t * (t + 1) * 100 + 25) }
}

// ---------- World 4: Base-10 Siblings ----------

function genSibling(): Problem & { f: number; a: number; b: number } {
  const f = ri(1, 9), a = ri(1, 9), b = 10 - a
  const n1 = f * 10 + a, n2 = f * 10 + b
  return {
    display: `${n1} × ${n2}`,
    answer: String(f * (f + 1) * 100 + a * b),
    f, a, b,
  }
}

function genSiblingHighlight(): Problem {
  const p = genSibling()
  return {
    ...p,
    parts: [
      { text: String(p.f), color: 'blue' }, { text: String(p.a), color: 'green' },
      { text: ' × ' },
      { text: String(p.f), color: 'blue' }, { text: String(p.b), color: 'green' },
    ],
  }
}

function genSiblingSwipe(): Problem {
  const valid = Math.random() < 0.5
  if (valid) {
    const p = genSibling()
    return { display: p.display, answer: p.answer, valid: true }
  }
  const f = ri(1, 9), a = ri(1, 9)
  // Invalid: either the last digits don't sum to 10, or the first digits differ.
  let n1 = f * 10 + a, n2: number
  if (Math.random() < 0.5) {
    let b = ri(1, 9)
    if (a + b === 10) b = b === 9 ? 1 : b + 1
    n2 = f * 10 + b
  } else {
    const f2 = f === 9 ? ri(1, 8) : ri(f + 1, 9)
    n2 = f2 * 10 + (10 - a)
  }
  return { display: `${n1} × ${n2}`, answer: String(n1 * n2), valid: false }
}

// ---------- World 5: Teen Matrix ----------

function genTeen(highTier = false): Problem {
  const lo = highTier ? 6 : 1
  const a = 10 + ri(lo, 9), b = 10 + ri(lo, 9)
  const ua = a % 10, ub = b % 10
  return {
    display: `${a} × ${b}`,
    answer: String(a * b),
    steps: [
      { label: `${a} + ${ub}, then ×10`, answer: String((a + ub) * 10) },
      { label: `${ua} × ${ub}`, answer: String(ua * ub) },
      { label: 'Final answer', answer: String(a * b) },
    ],
  }
}

// ---------- World 6: Left-to-Right Multiplication (2×1) ----------

function gen2x1(opts: { simple?: boolean } = {}): Problem {
  for (;;) {
    const t = ri(1, 9), o = ri(1, 9), d = ri(3, 9)
    // Level 1 keeps the final addition from crossing a hundreds boundary.
    if (opts.simple && ((t * 10 * d) % 100) + o * d >= 100) continue
    const a = t * 10 + o
    return {
      display: `${a} × ${d}`,
      speech: `${a} times ${d}`,
      answer: String(a * d),
      steps: [
        { label: `${t}0 × ${d}`, answer: String(t * 10 * d) },
        { label: `${o} × ${d}`, answer: String(o * d) },
        { label: 'Final answer', answer: String(a * d) },
      ],
    }
  }
}

function gen2x1Partial(): Problem {
  const p = gen2x1()
  return {
    ...p,
    steps: [
      { label: 'Tens part', answer: p.steps![0].answer },
      { label: 'Ones part', answer: p.steps![1].answer },
      { label: 'Add them!', answer: p.answer },
    ],
  }
}

// ---------- World 7: Subtraction Overshoot ----------

function genOvershoot(): Problem {
  const t = ri(1, 8), u = ri(7, 9), d = ri(3, 9)
  const a = t * 10 + u
  const r = (t + 1) * 10, diff = r - a
  return {
    display: `${a} × ${d}`,
    answer: String(a * d),
    steps: [
      { label: `Round up: ${r} × ${d}`, answer: String(r * d) },
      { label: `Overshoot: ${diff} × ${d}`, answer: String(diff * d) },
      { label: 'Final answer', answer: String(a * d) },
    ],
  }
}

function genOptimizerMix(): Problem {
  if (Math.random() < 0.5) return genOvershoot()
  const t = ri(1, 9), o = ri(1, 4), d = ri(3, 9)
  const a = t * 10 + o
  return { display: `${a} × ${d}`, answer: String(a * d) }
}

// ---------- World 8: 3×1 Cascading ----------

function gen3x1(): Problem {
  const h = ri(1, 9), t = ri(1, 9), o = ri(1, 9), d = ri(3, 9)
  const n = h * 100 + t * 10 + o
  return {
    display: `${n} × ${d}`,
    speech: `${n} times ${d}`,
    answer: String(n * d),
    steps: [
      { label: `${h}00×${d} + ${t}0×${d}`, answer: String((h * 100 + t * 10) * d) },
      { label: `${o} × ${d}`, answer: String(o * d) },
      { label: 'Final answer', answer: String(n * d) },
    ],
  }
}

// ---------- World 9: 2×2 Factoring ----------

const FACTOR_MAP: Record<number, [number, number]> = {
  12: [6, 2], 14: [7, 2], 15: [5, 3], 16: [8, 2], 18: [9, 2],
  24: [8, 3], 27: [9, 3], 28: [7, 4], 32: [8, 4], 36: [9, 4],
}
const FACTORABLES = Object.keys(FACTOR_MAP).map(Number)

function genFactorBase() {
  const fac = pick(FACTORABLES)
  let other = ri(13, 89)
  while (FACTORABLES.includes(other)) other = ri(13, 89)
  const [big, small] = FACTOR_MAP[fac]
  return { fac, other, big, small }
}

function genFactorExtract(): Problem {
  const { fac, other, big, small } = genFactorBase()
  return {
    display: `${other} × ${fac}`,
    answer: String(other * fac),
    steps: [
      { label: `${fac} = big factor…`, answer: String(big) },
      { label: `…× small factor`, answer: String(small) },
    ],
  }
}

function genFactorChain(): Problem {
  const { fac, other, big, small } = genFactorBase()
  return {
    display: `${other} × ${fac}`,
    answer: String(other * fac),
    steps: [
      { label: `${other} × ${big}`, answer: String(other * big) },
      { label: `× ${small}`, answer: String(other * big * small) },
    ],
  }
}

function genFactorFull(): Problem {
  const { fac, other } = genFactorBase()
  return { display: `${other} × ${fac}`, answer: String(other * fac) }
}

// ---------- The Curriculum ----------

export const WORLDS: WorldDef[] = [
  {
    id: 'ltr-add',
    name: 'Left-to-Right Addition',
    emoji: '🌊',
    color: '#4cc9f0',
    rule: 'Add the BIG parts first, then the small parts — just like reading!',
    example: {
      prompt: '70 + 60',
      steps: ['7 + 6 = 13', 'Put the zero back on!'],
      answer: '130',
    },
    levels: [
      { id: 'ltr-add-1', name: 'Visual Mechanics', desc: 'Read it, solve it. No timer!', mode: 'standard', streak: 10, timeLimit: null, gen: genAddNoOverlap },
      { id: 'ltr-add-2', name: 'The Carry Threshold', desc: 'Watch for the carry. 4 seconds each!', mode: 'standard', streak: 15, timeLimit: 4, gen: genAddCarry },
      { id: 'ltr-add-3', name: 'Auditory Processing', desc: 'Ears only! Listen and solve.', mode: 'audio', streak: 20, timeLimit: 3, gen: genAddAudio },
    ],
  },
  {
    id: 'power-11',
    name: 'Power of 11',
    emoji: '✨',
    color: '#f72585',
    rule: 'Split the digits apart, add them together, and pop the sum in the middle!',
    example: {
      prompt: '53 × 11',
      steps: ['Split: 5 _ 3', '5 + 3 = 8', 'Pop it in the middle!'],
      answer: '583',
    },
    levels: [
      { id: 'power-11-1', name: 'The Split Scaffolding', desc: 'Fill the magic middle box.', mode: 'split', streak: 10, timeLimit: null, gen: genElevenSplit },
      { id: 'power-11-2', name: 'Carry-Over Introduction', desc: 'Big sums carry to the left. All in your head!', mode: 'standard', streak: 15, timeLimit: null, gen: () => genEleven(false) },
      { id: 'power-11-3', name: 'Three-Digit Expansion', desc: 'Cascade the sums. 5 seconds each!', mode: 'standard', streak: 15, timeLimit: 5, gen: genElevenThreeDigit },
    ],
  },
  {
    id: 'square-5',
    name: 'Squaring 5s',
    emoji: '🎯',
    color: '#ff9e00',
    rule: 'Multiply the first digit by its bigger neighbor, then stick 25 on the end!',
    example: {
      prompt: '65²',
      steps: ['6 × 7 = 42', 'Attach 25'],
      answer: '4225',
    },
    levels: [
      { id: 'square-5-1', name: 'Standard Execution', desc: 'Neighbor math + 25. 4 seconds!', mode: 'standard', streak: 15, timeLimit: 4, gen: () => genSquare5() },
      { id: 'square-5-2', name: 'Flash-and-Fade', desc: 'Memorize it fast — it vanishes!', mode: 'flash', streak: 20, timeLimit: 3, flashSeconds: 1.5, gen: () => genSquare5() },
      { id: 'square-5-3', name: 'Three-Digit Expansion', desc: 'Big numbers, no timer. Deep focus!', mode: 'standard', streak: 10, timeLimit: null, gen: () => genSquare5(true) },
    ],
  },
  {
    id: 'siblings',
    name: 'Base-10 Siblings',
    emoji: '👯',
    color: '#7bd88f',
    rule: 'Same first digit + last digits that make 10? First × neighbor, then last × last!',
    example: {
      prompt: '84 × 86',
      steps: ['8 × 9 = 72', '4 × 6 = 24', 'Glue them together'],
      answer: '7224',
    },
    levels: [
      { id: 'siblings-1', name: 'Pattern Recognition', desc: 'The colors show you the pattern.', mode: 'highlight', streak: 10, timeLimit: null, gen: genSiblingHighlight },
      { id: 'siblings-2', name: 'The Squeeze', desc: 'No colors, 3.5 seconds. Spot it fast!', mode: 'standard', streak: 15, timeLimit: 3.5, gen: genSibling },
      { id: 'siblings-3', name: 'The Validator Gauntlet', desc: 'Swipe ➡️ if the trick works, ⬅️ if not!', mode: 'swipe', streak: 30, timeLimit: 1.5, gen: genSiblingSwipe },
    ],
  },
  {
    id: 'teen',
    name: 'The Teen Matrix',
    emoji: '🤖',
    color: '#b5179e',
    rule: 'Add the first number to the last digit of the second, ×10, then add the last digits multiplied!',
    example: {
      prompt: '17 × 15',
      steps: ['17 + 5 = 22 → 220', '7 × 5 = 35', '220 + 35'],
      answer: '255',
    },
    levels: [
      { id: 'teen-1', name: 'Step-by-Step Scaffolding', desc: 'Type each phase of the trick.', mode: 'scaffold', streak: 10, timeLimit: null, gen: () => genTeen() },
      { id: 'teen-2', name: 'Internalization', desc: 'All three steps in your head. 6 seconds!', mode: 'standard', streak: 15, timeLimit: 6, gen: () => genTeen() },
      { id: 'teen-3', name: 'High-Tier Memory Tax', desc: 'Big trailing digits, heavy carries. 5 seconds!', mode: 'standard', streak: 20, timeLimit: 5, gen: () => genTeen(true) },
    ],
  },
  {
    id: 'ltr-mult',
    name: 'Left-to-Right Multiply',
    emoji: '🚀',
    color: '#4361ee',
    rule: 'Split into tens and ones, multiply each, then add the results together!',
    example: {
      prompt: '43 × 6',
      steps: ['40 × 6 = 240', '3 × 6 = 18', '240 + 18'],
      answer: '258',
    },
    levels: [
      { id: 'ltr-mult-1', name: 'Full Scaffold', desc: 'Every step written out for you.', mode: 'scaffold', streak: 10, timeLimit: null, gen: () => gen2x1({ simple: true }) },
      { id: 'ltr-mult-2', name: 'Partial Scaffold', desc: 'Split it in your head, dump it in the boxes.', mode: 'scaffold', streak: 15, timeLimit: 10, gen: gen2x1Partial },
      { id: 'ltr-mult-3', name: 'Pure Execution', desc: 'No crutches. 6 seconds each!', mode: 'standard', streak: 20, timeLimit: 6, gen: () => gen2x1() },
      { id: 'ltr-mult-4', name: 'Engine Overload', desc: '4.5 seconds. 30 in a row. Go go go!', mode: 'standard', streak: 30, timeLimit: 4.5, gen: () => gen2x1() },
    ],
  },
  {
    id: 'overshoot',
    name: 'Subtraction Overshoot',
    emoji: '🎈',
    color: '#ff6b6b',
    rule: 'Ends in 7, 8, or 9? Round UP, multiply, then subtract the overshoot!',
    example: {
      prompt: '59 × 7',
      steps: ['59 is 60 − 1', '60 × 7 = 420', '420 − 7'],
      answer: '413',
    },
    levels: [
      { id: 'overshoot-1', name: 'The Breakdown', desc: 'Type the overshoot logic step by step.', mode: 'scaffold', streak: 10, timeLimit: null, gen: genOvershoot },
      { id: 'overshoot-2', name: 'Internalization', desc: 'Round, multiply, subtract — 5 seconds!', mode: 'standard', streak: 15, timeLimit: 5, gen: genOvershoot },
      { id: 'overshoot-3', name: 'The Optimizer Gauntlet', desc: 'Pick the best method instantly. 4 seconds!', mode: 'standard', streak: 20, timeLimit: 4, gen: genOptimizerMix },
    ],
  },
  {
    id: 'cascade',
    name: '3×1 Cascading',
    emoji: '🌋',
    color: '#f77f00',
    rule: 'Hundreds first, then tens — add those right away! — then the ones.',
    example: {
      prompt: '324 × 7',
      steps: ['300×7 = 2100', '20×7 = 140 → 2240', '4×7 = 28', '2240 + 28'],
      answer: '2268',
    },
    levels: [
      { id: 'cascade-1', name: 'Intermediate Consolidation', desc: 'Type the running total, then finish.', mode: 'scaffold', streak: 10, timeLimit: null, gen: gen3x1 },
      { id: 'cascade-2', name: 'Working Memory Squeeze', desc: 'It flashes for 2.5s, then… gone!', mode: 'flash', streak: 15, timeLimit: 7, flashSeconds: 2.5, gen: gen3x1 },
      { id: 'cascade-3', name: 'Audio Engine', desc: 'Completely blind. Ears and brain only!', mode: 'audio', streak: 15, timeLimit: 8, gen: gen3x1 },
    ],
  },
  {
    id: 'factoring',
    name: '2×2 Factoring',
    emoji: '🧩',
    color: '#9d4edd',
    rule: 'Break one number into small factors, then multiply twice — big factor first!',
    example: {
      prompt: '23 × 16',
      steps: ['16 = 8 × 2', '23 × 8 = 184', '184 × 2'],
      answer: '368',
    },
    levels: [
      { id: 'factoring-1', name: 'Optimal Extraction', desc: 'Don’t solve — just find the factors!', mode: 'scaffold', streak: 10, timeLimit: null, gen: genFactorExtract },
      { id: 'factoring-2', name: 'Sequential Scaffolding', desc: 'Complete the multiplication chain.', mode: 'scaffold', streak: 10, timeLimit: null, gen: genFactorChain },
      { id: 'factoring-3', name: 'Full Execution', desc: 'The whole chain in your head. 10 seconds!', mode: 'standard', streak: 15, timeLimit: 10, gen: genFactorFull },
    ],
  },
]

export const ALL_LEVELS = WORLDS.flatMap((w) => w.levels.map((l) => ({ ...l, world: w })))

export function findLevel(id: string) {
  return ALL_LEVELS.find((l) => l.id === id)
}

/** Merge a parent's tuning over a level's built-in variables (preserves world + generator). */
export function applyOverride<T extends LevelDef>(level: T, o?: LevelOverride): T {
  if (!o) return level
  return {
    ...level,
    streak: o.streak ?? level.streak,
    timeLimit: o.timeLimit !== undefined ? o.timeLimit : level.timeLimit,
    flashSeconds: o.flashSeconds ?? level.flashSeconds,
  }
}

/** Flat ordering used for sequential unlocking. */
export const LEVEL_ORDER = ALL_LEVELS.map((l) => l.id)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameConfig, GamePrize } from "@/lib/minigames";

export type GameProps = {
  config: GameConfig;
  /** Server-decided prize slot for chance games. Never computed on the client. */
  prizeIndex?: number;
  onSubmit: (score: number, meta?: Record<string, unknown>) => void;
  submitting: boolean;
};

/* ------------------------------------------------------------------ utils */
function useCountdown(seconds: number, onEnd: () => void, active = true) {
  const [left, setLeft] = useState(seconds);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    if (!active) return;
    setLeft(seconds);
    const started = Date.now();
    const t = setInterval(() => {
      const rem = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(rem);
      if (rem <= 0) {
        clearInterval(t);
        endRef.current();
      }
    }, 200);
    return () => clearInterval(t);
  }, [seconds, active]);
  return left;
}

function Timer({ left, total }: { left: number; total: number }) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-foreground/60">
        <span>Time</span>
        <span className="tabular-nums text-[color:var(--gold)]">{left}s</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] transition-[width] duration-200"
          style={{ width: `${(left / Math.max(1, total)) * 100}%` }}
        />
      </div>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">{label}</p>
      <p className="text-lg font-black tabular-nums text-foreground">{value}</p>
    </div>
  );
}

const pct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/* ------------------------------------------------------- 1. DAILY SPIN --- */
export function DailySpinGame({ config, prizeIndex = 0, onSubmit, submitting }: GameProps) {
  const prizes = (config.prizes ?? []) as GamePrize[];
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const done = useRef(false);

  const spin = () => {
    if (spinning || done.current || prizes.length === 0) return;
    setSpinning(true);
    const slice = 360 / prizes.length;
    const target = 360 * 6 + (360 - (prizeIndex * slice + slice / 2));
    setAngle(target);
    window.setTimeout(() => {
      done.current = true;
      setSpinning(false);
      onSubmit(1, { prize_index: prizeIndex });
    }, 4200);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[280px] w-[280px]">
        <div className="absolute left-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-[color:var(--gold)]" />
        <div
          className="h-full w-full rounded-full border-4 border-[color:var(--gold)] shadow-[0_0_50px_-10px_var(--gold)]"
          style={{
            transform: `rotate(${angle}deg)`,
            transition: "transform 4s cubic-bezier(.16,.9,.24,1)",
            background: `conic-gradient(${prizes
              .map((_, i) => {
                const c = i % 2 ? "rgba(255,207,106,.85)" : "rgba(124,92,255,.85)";
                const a = (i * 100) / prizes.length;
                const b = ((i + 1) * 100) / prizes.length;
                return `${c} ${a}% ${b}%`;
              })
              .join(",")})`,
          }}
        >
          {prizes.map((p, i) => {
            const slice = 360 / prizes.length;
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 origin-left text-[10px] font-black text-black/80"
                style={{ transform: `rotate(${i * slice + slice / 2}deg) translateX(34px)` }}
              >
                {p.label}
              </div>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-[color:var(--gold)] bg-background text-2xl">
            🎡
          </div>
        </div>
      </div>
      <button
        onClick={spin}
        disabled={spinning || submitting || done.current}
        className="mt-6 w-full rounded-2xl bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] py-3 text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-50"
      >
        {spinning ? "Spinning…" : submitting ? "Confirming…" : "Spin"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------- 2. LUCKY BOX --- */
export function LuckyBoxGame({ config, prizeIndex = 0, onSubmit, submitting }: GameProps) {
  const prizes = (config.prizes ?? []) as GamePrize[];
  const [opened, setOpened] = useState<number | null>(null);
  const boxes = [0, 1, 2];

  const open = (i: number) => {
    if (opened !== null) return;
    setOpened(i);
    window.setTimeout(() => onSubmit(1, { box: i, prize_index: prizeIndex }), 1200);
  };

  return (
    <div className="text-center">
      <p className="mb-6 text-xs font-semibold text-foreground/60">Pick a box to reveal today's reward</p>
      <div className="grid grid-cols-3 gap-3">
        {boxes.map((i) => (
          <button
            key={i}
            onClick={() => open(i)}
            disabled={opened !== null || submitting}
            className={`aspect-square rounded-3xl border-2 text-5xl transition-transform ${
              opened === i
                ? "scale-105 border-[color:var(--gold)] bg-[color:var(--gold)]/20"
                : "border-white/10 bg-white/5 active:scale-95"
            } ${opened !== null && opened !== i ? "opacity-30" : ""}`}
          >
            {opened === i ? "🎉" : "🎁"}
          </button>
        ))}
      </div>
      {opened !== null && (
        <p className="mt-5 text-sm font-bold text-[color:var(--gold)]">
          {submitting ? "Confirming with server…" : prizes[prizeIndex]?.label ?? "Opening…"}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------ 3. MEMORY MATCH -- */
export function MemoryMatchGame({ config, onSubmit, submitting }: GameProps) {
  const pairs = config.pairs ?? 8;
  const seconds = config.seconds ?? 60;
  const EMOJI = ["🍒", "⭐", "💎", "🔥", "🎵", "🌙", "🍀", "👑", "🦄", "🎯"];
  const deck = useMemo(() => {
    const cards = EMOJI.slice(0, pairs).flatMap((e, i) => [
      { id: i * 2, e },
      { id: i * 2 + 1, e },
    ]);
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j]!, cards[i]!];
    }
    return cards;
  }, [pairs]);

  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const ended = useRef(false);

  const finish = useCallback(
    (timeLeft: number) => {
      if (ended.current) return;
      ended.current = true;
      const completion = matched.length / (pairs * 2);
      const efficiency = moves > 0 ? Math.min(1, pairs / Math.max(1, moves)) : 0;
      const timeBonus = timeLeft / seconds;
      onSubmit(pct(completion * 70 + efficiency * 20 + timeBonus * 10), { moves });
    },
    [matched.length, moves, onSubmit, pairs, seconds],
  );

  const left = useCountdown(seconds, () => finish(0));

  useEffect(() => {
    if (matched.length === pairs * 2 && !ended.current) finish(left);
  }, [matched.length, pairs, finish, left]);

  const flip = (idx: number) => {
    if (submitting || flipped.length >= 2 || flipped.includes(idx) || matched.includes(idx)) return;
    const next = [...flipped, idx];
    setFlipped(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next;
      if (deck[a!]!.e === deck[b!]!.e) {
        setMatched((m) => [...m, a!, b!]);
        setFlipped([]);
      } else {
        window.setTimeout(() => setFlipped([]), 700);
      }
    }
  };

  return (
    <div>
      <Timer left={left} total={seconds} />
      <div className="grid grid-cols-4 gap-2">
        {deck.map((c, idx) => {
          const show = flipped.includes(idx) || matched.includes(idx);
          return (
            <button
              key={idx}
              onClick={() => flip(idx)}
              className={`aspect-square rounded-2xl border text-2xl transition-all ${
                show
                  ? "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/15"
                  : "border-white/10 bg-white/5 active:scale-95"
              }`}
            >
              {show ? c.e : "❔"}
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <ScorePill label="Pairs" value={`${matched.length / 2}/${pairs}`} />
        <ScorePill label="Moves" value={moves} />
      </div>
    </div>
  );
}

/* ----------------------------------------------------- 4. TAP CHALLENGE -- */
export function TapChallengeGame({ config, onSubmit, submitting }: GameProps) {
  const seconds = config.seconds ?? 10;
  const [taps, setTaps] = useState(0);
  const tapsRef = useRef(0);
  const ended = useRef(false);
  const left = useCountdown(seconds, () => {
    if (ended.current) return;
    ended.current = true;
    onSubmit(tapsRef.current, { taps: tapsRef.current });
  });

  return (
    <div>
      <Timer left={left} total={seconds} />
      <button
        onClick={() => {
          if (ended.current || submitting) return;
          tapsRef.current += 1;
          setTaps(tapsRef.current);
        }}
        className="grid aspect-square w-full place-items-center rounded-[2rem] border-2 border-[color:var(--primary)]/50 bg-gradient-to-br from-[color:var(--primary)]/25 to-[color:var(--secondary)]/25 active:scale-95"
      >
        <div>
          <p className="text-6xl font-black tabular-nums text-foreground">{taps}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-foreground/60">Tap!</p>
        </div>
      </button>
    </div>
  );
}

/* ---------------------------------------------------- 5. REACTION SPEED -- */
export function ReactionSpeedGame({ config, onSubmit, submitting }: GameProps) {
  const rounds = config.rounds ?? 5;
  const [state, setState] = useState<"wait" | "ready" | "go">("wait");
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const goAt = useRef(0);
  const timer = useRef<number | null>(null);
  const ended = useRef(false);

  const schedule = useCallback(() => {
    setState("ready");
    timer.current = window.setTimeout(() => {
      goAt.current = performance.now();
      setState("go");
    }, 1200 + Math.random() * 2600);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const tap = () => {
    if (submitting || ended.current) return;
    if (state === "wait") { schedule(); return; }
    if (state === "ready") {
      if (timer.current) clearTimeout(timer.current);
      setTimes((t) => [...t, 1000]); // false start penalty
      next([...times, 1000]);
      return;
    }
    const ms = Math.round(performance.now() - goAt.current);
    setTimes((t) => [...t, ms]);
    next([...times, ms]);
  };

  const next = (all: number[]) => {
    const r = round + 1;
    setRound(r);
    if (r >= rounds) {
      ended.current = true;
      const avg = all.reduce((a, b) => a + b, 0) / all.length;
      onSubmit(pct(((600 - Math.min(600, avg)) / 450) * 100), { avg_ms: Math.round(avg) });
      setState("wait");
    } else {
      setState("wait");
      window.setTimeout(schedule, 500);
    }
  };

  return (
    <div>
      <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-foreground/60">
        Round {Math.min(round + 1, rounds)} / {rounds}
      </p>
      <button
        onClick={tap}
        className={`grid aspect-square w-full place-items-center rounded-[2rem] border-2 text-center transition-colors ${
          state === "go"
            ? "border-emerald-400 bg-emerald-500/30"
            : state === "ready"
              ? "border-rose-400 bg-rose-500/25"
              : "border-white/10 bg-white/5"
        }`}
      >
        <div>
          <p className="text-3xl font-black">
            {state === "go" ? "TAP NOW" : state === "ready" ? "Wait…" : "Tap to start"}
          </p>
          {times.length > 0 && (
            <p className="mt-2 text-xs text-foreground/60">Last: {times[times.length - 1]}ms</p>
          )}
        </div>
      </button>
    </div>
  );
}

/* --------------------------------------------------- 6. PUZZLE CHALLENGE - */
export function PuzzleChallengeGame({ config, onSubmit, submitting }: GameProps) {
  const size = config.size ?? 3;
  const seconds = config.seconds ?? 120;
  const total = size * size;
  const solved = useMemo(() => Array.from({ length: total }, (_, i) => (i + 1) % total), [total]);
  const [tiles, setTiles] = useState<number[]>(() => {
    const t = [...solved];
    for (let i = 0; i < 200; i++) {
      const zero = t.indexOf(0);
      const moves = neighbors(zero, size);
      const pick = moves[Math.floor(Math.random() * moves.length)]!;
      [t[zero], t[pick]] = [t[pick]!, t[zero]!];
    }
    return t;
  });
  const [moves, setMoves] = useState(0);
  const ended = useRef(false);

  const finish = useCallback(
    (timeLeft: number, arr: number[]) => {
      if (ended.current) return;
      ended.current = true;
      const correct = arr.filter((v, i) => v === solved[i]).length / total;
      const isSolved = correct === 1;
      onSubmit(isSolved ? pct(90 + (timeLeft / seconds) * 10) : pct(correct * 70), { moves, solved: isSolved });
    },
    [moves, onSubmit, seconds, solved, total],
  );

  const left = useCountdown(seconds, () => finish(0, tiles));

  const move = (i: number) => {
    if (submitting || ended.current) return;
    const zero = tiles.indexOf(0);
    if (!neighbors(zero, size).includes(i)) return;
    const next = [...tiles];
    [next[zero], next[i]] = [next[i]!, next[zero]!];
    setTiles(next);
    setMoves((m) => m + 1);
    if (next.every((v, idx) => v === solved[idx])) finish(left, next);
  };

  return (
    <div>
      <Timer left={left} total={seconds} />
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${size},minmax(0,1fr))` }}>
        {tiles.map((v, i) => (
          <button
            key={i}
            onClick={() => move(i)}
            className={`aspect-square rounded-2xl text-2xl font-black transition-all ${
              v === 0
                ? "bg-transparent"
                : "border border-[color:var(--primary)]/40 bg-gradient-to-br from-[color:var(--primary)]/25 to-[color:var(--secondary)]/20 active:scale-95"
            }`}
          >
            {v === 0 ? "" : v}
          </button>
        ))}
      </div>
      <div className="mt-4"><ScorePill label="Moves" value={moves} /></div>
    </div>
  );
}

function neighbors(idx: number, size: number) {
  const r = Math.floor(idx / size);
  const c = idx % size;
  const out: number[] = [];
  if (r > 0) out.push(idx - size);
  if (r < size - 1) out.push(idx + size);
  if (c > 0) out.push(idx - 1);
  if (c < size - 1) out.push(idx + 1);
  return out;
}

/* ----------------------------------------------------- 7. MATH CHALLENGE - */
type MathQ = { text: string; answer: number; options: number[] };
function makeMath(): MathQ {
  const ops = ["+", "-", "×"] as const;
  const op = ops[Math.floor(Math.random() * ops.length)]!;
  const a = 2 + Math.floor(Math.random() * (op === "×" ? 11 : 60));
  const b = 2 + Math.floor(Math.random() * (op === "×" ? 11 : 40));
  const answer = op === "+" ? a + b : op === "-" ? a - b : a * b;
  const set = new Set<number>([answer]);
  while (set.size < 4) set.add(answer + (Math.floor(Math.random() * 21) - 10) || answer + 1);
  return {
    text: `${a} ${op} ${b}`,
    answer,
    options: [...set].sort(() => Math.random() - 0.5),
  };
}

export function MathChallengeGame({ config, onSubmit, submitting }: GameProps) {
  const seconds = config.seconds ?? 45;
  const [q, setQ] = useState<MathQ>(() => makeMath());
  const [correct, setCorrect] = useState(0);
  const correctRef = useRef(0);
  const [wrong, setWrong] = useState(0);
  const ended = useRef(false);
  const left = useCountdown(seconds, () => {
    if (ended.current) return;
    ended.current = true;
    onSubmit(pct(correctRef.current * 8), { correct: correctRef.current });
  });

  const answer = (v: number) => {
    if (submitting || ended.current) return;
    if (v === q.answer) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
    } else setWrong((w) => w + 1);
    setQ(makeMath());
  };

  return (
    <div>
      <Timer left={left} total={seconds} />
      <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/5 py-8">
        <p className="text-4xl font-black tabular-nums">{q.text} = ?</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {q.options.map((o) => (
          <button
            key={o}
            onClick={() => answer(o)}
            className="rounded-2xl border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/15 py-4 text-xl font-black active:scale-95"
          >
            {o}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <ScorePill label="Correct" value={correct} />
        <ScorePill label="Wrong" value={wrong} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------- 8. WORD PUZZLE - */
const WORDS = ["JALWA", "PARTY", "MUSIC", "CROWN", "LUCKY", "STAGE", "VOICE", "MAGIC", "ROYAL", "SOUND", "LIGHT", "DANCE"];
export function WordPuzzleGame({ config, onSubmit, submitting }: GameProps) {
  const rounds = config.rounds ?? 6;
  const seconds = config.seconds ?? 90;
  const list = useMemo(() => [...WORDS].sort(() => Math.random() - 0.5).slice(0, rounds), [rounds]);
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState("");
  const [correct, setCorrect] = useState(0);
  const correctRef = useRef(0);
  const ended = useRef(false);

  const finish = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    onSubmit(pct((correctRef.current / rounds) * 100), { correct: correctRef.current });
  }, [onSubmit, rounds]);

  const left = useCountdown(seconds, finish);
  const word = list[idx] ?? "";
  const scrambled = useMemo(() => [...word].sort(() => Math.random() - 0.5).join(" "), [word]);

  const submitWord = () => {
    if (submitting || ended.current) return;
    if (guess.trim().toUpperCase() === word) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
    }
    setGuess("");
    if (idx + 1 >= list.length) finish();
    else setIdx(idx + 1);
  };

  return (
    <div>
      <Timer left={left} total={seconds} />
      <p className="text-center text-xs font-bold uppercase tracking-widest text-foreground/60">
        Word {Math.min(idx + 1, rounds)} / {rounds}
      </p>
      <div className="mt-3 grid place-items-center rounded-3xl border border-white/10 bg-white/5 py-8">
        <p className="text-3xl font-black tracking-[0.35em] text-[color:var(--gold)]">{scrambled}</p>
      </div>
      <input
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submitWord()}
        placeholder="Type the word"
        autoComplete="off"
        className="mt-4 w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-center text-lg font-black uppercase tracking-widest outline-none focus:border-[color:var(--primary)]"
      />
      <button
        onClick={submitWord}
        className="mt-3 w-full rounded-2xl bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--secondary)] py-3 text-sm font-black uppercase tracking-widest text-primary-foreground"
      >
        Submit
      </button>
      <div className="mt-4"><ScorePill label="Correct" value={`${correct}/${rounds}`} /></div>
    </div>
  );
}

/* -------------------------------------------------------- 9. QUIZ BATTLE - */
type Quiz = { q: string; a: string[]; c: number };
const QUIZ: Quiz[] = [
  { q: "Which planet is the Red Planet?", a: ["Venus", "Mars", "Jupiter", "Mercury"], c: 1 },
  { q: "How many continents are there?", a: ["5", "6", "7", "8"], c: 2 },
  { q: "Largest ocean on Earth?", a: ["Atlantic", "Indian", "Arctic", "Pacific"], c: 3 },
  { q: "What is 15% of 200?", a: ["25", "30", "35", "20"], c: 1 },
  { q: "Fastest land animal?", a: ["Cheetah", "Lion", "Horse", "Falcon"], c: 0 },
  { q: "Which gas do plants absorb?", a: ["Oxygen", "Nitrogen", "CO₂", "Helium"], c: 2 },
  { q: "Currency of Japan?", a: ["Won", "Yuan", "Yen", "Ringgit"], c: 2 },
  { q: "How many minutes in 3 hours?", a: ["150", "180", "210", "120"], c: 1 },
  { q: "Which is a programming language?", a: ["Pluto", "Python", "Panda", "Pixel"], c: 1 },
  { q: "Tallest mountain in the world?", a: ["K2", "Kilimanjaro", "Everest", "Denali"], c: 2 },
  { q: "How many sides has a hexagon?", a: ["5", "6", "7", "8"], c: 1 },
  { q: "Water freezes at?", a: ["0°C", "10°C", "-10°C", "5°C"], c: 0 },
];

export function QuizBattleGame({ config, onSubmit, submitting }: GameProps) {
  const count = config.questions ?? 10;
  const perQ = config.seconds ?? 10;
  const list = useMemo(() => [...QUIZ].sort(() => Math.random() - 0.5).slice(0, count), [count]);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const correctRef = useRef(0);
  const [picked, setPicked] = useState<number | null>(null);
  const ended = useRef(false);

  const finish = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    onSubmit(pct((correctRef.current / count) * 100), { correct: correctRef.current });
  }, [count, onSubmit]);

  const advance = useCallback(() => {
    setPicked(null);
    if (idx + 1 >= list.length) finish();
    else setIdx(idx + 1);
  }, [finish, idx, list.length]);

  const left = useCountdown(perQ, advance, picked === null && !ended.current);
  const q = list[idx]!;

  const pick = (i: number) => {
    if (picked !== null || submitting || ended.current) return;
    setPicked(i);
    if (i === q.c) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
    }
    window.setTimeout(advance, 700);
  };

  return (
    <div>
      <Timer left={left} total={perQ} />
      <p className="text-center text-xs font-bold uppercase tracking-widest text-foreground/60">
        Question {idx + 1} / {list.length}
      </p>
      <div className="mt-3 grid min-h-[110px] place-items-center rounded-3xl border border-white/10 bg-white/5 px-4 py-6 text-center">
        <p className="text-lg font-black">{q.q}</p>
      </div>
      <div className="mt-4 space-y-2">
        {q.a.map((a, i) => (
          <button
            key={i}
            onClick={() => pick(i)}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
              picked === null
                ? "border-white/10 bg-white/5 active:scale-[0.99]"
                : i === q.c
                  ? "border-emerald-400 bg-emerald-500/25"
                  : picked === i
                    ? "border-rose-400 bg-rose-500/25"
                    : "border-white/10 bg-white/5 opacity-50"
            }`}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="mt-4"><ScorePill label="Correct" value={`${correct}/${list.length}`} /></div>
    </div>
  );
}

/* -------------------------------------------------------- 10. COLOR MATCH - */
const COLORS = [
  { name: "RED", hex: "#f43f5e" },
  { name: "GREEN", hex: "#22c55e" },
  { name: "BLUE", hex: "#3b82f6" },
  { name: "YELLOW", hex: "#facc15" },
  { name: "PURPLE", hex: "#a855f7" },
];

export function ColorMatchGame({ config, onSubmit, submitting }: GameProps) {
  const seconds = config.seconds ?? 40;
  const rand = () => {
    const word = COLORS[Math.floor(Math.random() * COLORS.length)]!;
    const ink = Math.random() < 0.5 ? word : COLORS[Math.floor(Math.random() * COLORS.length)]!;
    return { word, ink };
  };
  const [cur, setCur] = useState(rand);
  const [correct, setCorrect] = useState(0);
  const correctRef = useRef(0);
  const [wrong, setWrong] = useState(0);
  const ended = useRef(false);
  const left = useCountdown(seconds, () => {
    if (ended.current) return;
    ended.current = true;
    onSubmit(pct(correctRef.current * 5), { correct: correctRef.current });
  });

  const answer = (match: boolean) => {
    if (submitting || ended.current) return;
    const truth = cur.word.name === cur.ink.name;
    if (match === truth) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
    } else {
      setWrong((w) => w + 1);
      correctRef.current = Math.max(0, correctRef.current - 1);
      setCorrect(correctRef.current);
    }
    setCur(rand());
  };

  return (
    <div>
      <Timer left={left} total={seconds} />
      <p className="text-center text-xs font-semibold text-foreground/60">
        Does the word match its colour?
      </p>
      <div className="mt-3 grid place-items-center rounded-3xl border border-white/10 bg-white/5 py-12">
        <p className="text-5xl font-black tracking-widest" style={{ color: cur.ink.hex }}>
          {cur.word.name}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => answer(false)}
          className="rounded-2xl border border-rose-400/50 bg-rose-500/20 py-4 text-lg font-black active:scale-95"
        >
          ✗ No
        </button>
        <button
          onClick={() => answer(true)}
          className="rounded-2xl border border-emerald-400/50 bg-emerald-500/20 py-4 text-lg font-black active:scale-95"
        >
          ✓ Yes
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <ScorePill label="Score" value={correct} />
        <ScorePill label="Misses" value={wrong} />
      </div>
    </div>
  );
}

export const GAME_COMPONENTS: Record<string, (p: GameProps) => JSX.Element> = {
  daily_spin: DailySpinGame,
  lucky_box: LuckyBoxGame,
  memory_match: MemoryMatchGame,
  tap_challenge: TapChallengeGame,
  reaction_speed: ReactionSpeedGame,
  puzzle_challenge: PuzzleChallengeGame,
  math_challenge: MathChallengeGame,
  word_puzzle: WordPuzzleGame,
  quiz_battle: QuizBattleGame,
  color_match: ColorMatchGame,
};

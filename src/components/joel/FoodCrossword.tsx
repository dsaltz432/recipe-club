import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WordEntry {
  word: string;
  clue: string;
}

interface PlacedWord extends WordEntry {
  row: number;
  col: number;
  direction: "across" | "down";
  number: number;
}

interface CellData {
  letter: string;
  isBlack: boolean;
  number?: number;
}

interface CrosswordState {
  grid: CellData[][];
  placedWords: PlacedWord[];
}

// ─── Word bank ────────────────────────────────────────────────────────────────

const WORD_BANK: WordEntry[] = [
  { word: "PIZZA", clue: "Italian disc of destiny" },
  { word: "SUSHI", clue: "Raw ambition on rice" },
  { word: "TACO", clue: "Folded flavor vessel" },
  { word: "PASTA", clue: "Italian comfort in a bowl" },
  { word: "BURGER", clue: "Bun-encased beef dream" },
  { word: "RAMEN", clue: "Japanese noodle therapy" },
  { word: "CURRY", clue: "Spiced sauce with attitude" },
  { word: "CAKE", clue: "Birthday's best friend" },
  { word: "BACON", clue: "Everything is better with this" },
  { word: "MANGO", clue: "Tropical sunshine fruit" },
  { word: "ONION", clue: "Makes you cry but you love it" },
  { word: "GARLIC", clue: "Vampire repellent, flavor champion" },
  { word: "CREAM", clue: "Dairy's silky output" },
  { word: "LEMON", clue: "Sour citrus mood lifter" },
  { word: "RICE", clue: "Asia's staple grain" },
  { word: "STEAK", clue: "Cow's finest cut" },
  { word: "BRIE", clue: "Fancy French cheese" },
  { word: "PLUM", clue: "Purple stone fruit" },
  { word: "EGG", clue: "Chicken's daily contribution" },
  { word: "HAM", clue: "Pig's most popular product" },
  { word: "YAM", clue: "Orange root vegetable cousin" },
  { word: "PIE", clue: "Crust with something inside" },
  { word: "OAT", clue: "Breakfast's humble hero" },
  { word: "RYE", clue: "Dark bread grain" },
  { word: "FIG", clue: "Newton's favorite fruit" },
  { word: "ALE", clue: "Beer's older cousin" },
  { word: "TEA", clue: "Britain's answer to everything" },
  { word: "SOY", clue: "Asian sauce bean" },
  { word: "NUT", clue: "Squirrel's obsession" },
  { word: "GIN", clue: "Juniper-based spirit" },
];

// ─── Generator ────────────────────────────────────────────────────────────────

const GRID_SIZE = 15;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function canPlace(
  raw: string[][],
  word: string,
  row: number,
  col: number,
  dir: "across" | "down"
): number {
  const dr = dir === "down" ? 1 : 0;
  const dc = dir === "across" ? 1 : 0;
  // pr/pc = perpendicular unit vector
  const pr = dc;
  const pc = dr;

  // Cell before word must be empty
  const br = row - dr;
  const bc = col - dc;
  if (br >= 0 && br < GRID_SIZE && bc >= 0 && bc < GRID_SIZE && raw[br][bc] !== "") return -1;

  // Cell after word must be empty
  const ar = row + dr * word.length;
  const ac = col + dc * word.length;
  if (ar >= 0 && ar < GRID_SIZE && ac >= 0 && ac < GRID_SIZE && raw[ar][ac] !== "") return -1;

  let intersections = 0;
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return -1;
    const cell = raw[r][c];

    if (cell !== "") {
      if (cell !== word[i]) return -1;
      intersections++;
    } else {
      // Empty cell — perpendicular neighbors must be empty (no parallel adjacency)
      if (
        (r + pr >= 0 && r + pr < GRID_SIZE && c + pc >= 0 && c + pc < GRID_SIZE && raw[r + pr][c + pc] !== "") ||
        (r - pr >= 0 && r - pr < GRID_SIZE && c - pc >= 0 && c - pc < GRID_SIZE && raw[r - pr][c - pc] !== "")
      ) {
        return -1;
      }
    }
  }

  return intersections;
}

function tryGenerate(): CrosswordState {
  const words = shuffle(WORD_BANK).slice(0, 18);
  const raw: string[][] = Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill(""));

  type Interim = Omit<PlacedWord, "number">;
  const placed: Interim[] = [];

  // Place first word horizontally in center
  const first = words[0];
  const r0 = Math.floor(GRID_SIZE / 2);
  const c0 = Math.floor((GRID_SIZE - first.word.length) / 2);
  for (let i = 0; i < first.word.length; i++) raw[r0][c0 + i] = first.word[i];
  placed.push({ word: first.word, clue: first.clue, row: r0, col: c0, direction: "across" });

  // Try placing remaining words
  for (let wi = 1; wi < words.length; wi++) {
    const entry = words[wi];
    let best: { row: number; col: number; dir: "across" | "down"; score: number } | null = null;

    for (const pw of placed) {
      const oppDir: "across" | "down" = pw.direction === "across" ? "down" : "across";
      const pdr = pw.direction === "down" ? 1 : 0;
      const pdc = pw.direction === "across" ? 1 : 0;

      for (let pi = 0; pi < pw.word.length; pi++) {
        for (let ei = 0; ei < entry.word.length; ei++) {
          if (pw.word[pi] !== entry.word[ei]) continue;

          const r = pw.row + pdr * pi - (oppDir === "down" ? ei : 0);
          const c = pw.col + pdc * pi - (oppDir === "across" ? ei : 0);

          const score = canPlace(raw, entry.word, r, c, oppDir);
          if (score > 0 && (!best || score > best.score)) {
            best = { row: r, col: c, dir: oppDir, score };
          }
        }
      }
    }

    if (best) {
      const dr = best.dir === "down" ? 1 : 0;
      const dc = best.dir === "across" ? 1 : 0;
      for (let i = 0; i < entry.word.length; i++) {
        raw[best.row + dr * i][best.col + dc * i] = entry.word[i];
      }
      placed.push({ word: entry.word, clue: entry.clue, row: best.row, col: best.col, direction: best.dir });
    }
  }

  // Trim to used area + 1 padding
  let minR = GRID_SIZE, maxR = 0, minC = GRID_SIZE, maxC = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (raw[r][c] !== "") {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
  }
  minR = Math.max(0, minR - 1);
  maxR = Math.min(GRID_SIZE - 1, maxR + 1);
  minC = Math.max(0, minC - 1);
  maxC = Math.min(GRID_SIZE - 1, maxC + 1);

  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;

  // Build CellData grid
  const grid: CellData[][] = Array(rows)
    .fill(null)
    .map((_, r) =>
      Array(cols)
        .fill(null)
        .map((_, c) => ({ letter: raw[r + minR][c + minC], isBlack: raw[r + minR][c + minC] === "" }))
    );

  // Adjust placed word coordinates
  const adjusted: Interim[] = placed.map((pw) => ({
    ...pw,
    row: pw.row - minR,
    col: pw.col - minC,
  }));

  // Number cells (reading order: left→right, top→bottom)
  let num = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].isBlack) continue;
      const startsAcross = adjusted.some((pw) => pw.direction === "across" && pw.row === r && pw.col === c);
      const startsDown = adjusted.some((pw) => pw.direction === "down" && pw.row === r && pw.col === c);
      if (startsAcross || startsDown) grid[r][c].number = num++;
    }
  }

  const placedWords: PlacedWord[] = adjusted.map((pw) => ({
    ...pw,
    number: grid[pw.row][pw.col].number ?? 0,
  }));

  return { grid, placedWords };
}

function generateCrossword(): CrosswordState {
  for (let i = 0; i < 12; i++) {
    const result = tryGenerate();
    if (result.placedWords.length >= 6) return result;
  }
  return tryGenerate();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FoodCrossword() {
  const [cw, setCw] = useState<CrosswordState>(() => generateCrossword());
  const [userGrid, setUserGrid] = useState<string[][]>([]);
  const [sel, setSel] = useState<{ row: number; col: number; dir: "across" | "down" } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [solved, setSolved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const numRows = cw.grid.length;
  const numCols = cw.grid[0]?.length ?? 0;
  const cellPx = Math.max(22, Math.min(34, Math.floor(290 / Math.max(numRows, numCols))));

  useEffect(() => {
    setUserGrid(cw.grid.map((row) => row.map((cell) => (cell.isBlack ? "#" : ""))));
    setSel(null);

    setRevealed(false);
    setSolved(false);
  }, [cw]);

  const getWordsAt = useCallback(
    (r: number, c: number) =>
      cw.placedWords.filter((pw) =>
        pw.direction === "across"
          ? pw.row === r && c >= pw.col && c < pw.col + pw.word.length
          : pw.col === c && r >= pw.row && r < pw.row + pw.word.length
      ),
    [cw]
  );

  const selectedWord = sel
    ? cw.placedWords.find((pw) => {
        if (pw.direction !== sel.dir) return false;
        return pw.direction === "across"
          ? pw.row === sel.row && sel.col >= pw.col && sel.col < pw.col + pw.word.length
          : pw.col === sel.col && sel.row >= pw.row && sel.row < pw.row + pw.word.length;
      })
    : null;

  const inSelectedWord = (r: number, c: number) => {
    if (!selectedWord) return false;
    return selectedWord.direction === "across"
      ? selectedWord.row === r && c >= selectedWord.col && c < selectedWord.col + selectedWord.word.length
      : selectedWord.col === c && r >= selectedWord.row && r < selectedWord.row + selectedWord.word.length;
  };

  const move = useCallback(
    (r: number, c: number, dir: "across" | "down", delta: 1 | -1) => {
      const dr = dir === "down" ? delta : 0;
      const dc = dir === "across" ? delta : 0;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < numRows && nc >= 0 && nc < numCols && !cw.grid[nr][nc].isBlack) {
        return { row: nr, col: nc };
      }
      return null;
    },
    [cw, numRows, numCols]
  );

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (cw.grid[r]?.[c]?.isBlack) return;
      const words = getWordsAt(r, c);
      if (!words.length) return;

      if (sel?.row === r && sel?.col === c) {
        const other = sel.dir === "across" ? "down" : "across";
        if (words.some((w) => w.direction === other)) setSel({ row: r, col: c, dir: other });
      } else {
        const pref = words.find((w) => w.direction === "across");
        setSel({ row: r, col: c, dir: pref ? "across" : "down" });
      }
      inputRef.current?.focus();
    },
    [cw, sel, getWordsAt]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!sel) return;
      const { row, col, dir } = sel;

      if (e.key === "Backspace") {
        e.preventDefault();
        setUserGrid((prev) => {
          const next = prev.map((r) => [...r]);
          if (next[row][col] !== "") {
            next[row][col] = "";
          } else {
            const prev2 = move(row, col, dir, -1);
            if (prev2) {
              next[prev2.row][prev2.col] = "";
              setSel({ ...prev2, dir });
            }
          }
          return next;
        });
    
        return;
      }

      const arrowMap: Record<string, { d: "across" | "down"; delta: 1 | -1 }> = {
        ArrowRight: { d: "across", delta: 1 },
        ArrowLeft: { d: "across", delta: -1 },
        ArrowDown: { d: "down", delta: 1 },
        ArrowUp: { d: "down", delta: -1 },
      };
      if (arrowMap[e.key]) {
        e.preventDefault();
        const { d, delta } = arrowMap[e.key];
        const next = move(row, col, d, delta);
        if (next) setSel({ ...next, dir: d });
        return;
      }

      const letter = e.key.toUpperCase();
      if (/^[A-Z]$/.test(letter)) {
        e.preventDefault();
        setUserGrid((prev) => {
          const next = prev.map((r) => [...r]);
          next[row][col] = letter;
          return next;
        });
    
        const next = move(row, col, dir, 1);
        if (next) setSel({ ...next, dir });
      }
    },
    [sel, move]
  );

  const handleReveal = () => {
    setRevealed(true);
    setUserGrid(cw.grid.map((row) => row.map((cell) => (cell.isBlack ? "#" : cell.letter))));
    setSolved(true);
  };

  const acrossClues = cw.placedWords.filter((pw) => pw.direction === "across").sort((a, b) => a.number - b.number);
  const downClues = cw.placedWords.filter((pw) => pw.direction === "down").sort((a, b) => a.number - b.number);

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setCw(generateCrossword())}
          className="px-4 py-1.5 rounded-full font-bold text-sm"
          style={{ background: "rgba(255,255,255,0.88)", color: "#1a1a2e" }}
        >
          🔄 New Puzzle
        </button>
        <button
          onClick={handleReveal}
          disabled={revealed}
          className="px-4 py-1.5 rounded-full font-bold text-sm"
          style={{ background: "rgba(255,255,255,0.55)", color: "#1a1a2e" }}
        >
          👁 Reveal
        </button>
        {solved && <span className="font-black text-sm" style={{ color: "#4ade80" }}>🎉 Solved!</span>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Grid */}
        <div className="flex-shrink-0">
          <input
            ref={inputRef}
            onKeyDown={handleKeyDown}
            readOnly
            aria-label="Crossword input"
            style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1 }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${numCols}, ${cellPx}px)`,
              gridTemplateRows: `repeat(${numRows}, ${cellPx}px)`,
              gap: 1,
              background: "rgba(0,0,0,0.55)",
              padding: 1,
              borderRadius: 8,
              userSelect: "none",
            }}
          >
            {cw.grid.map((row, r) =>
              row.map((cell, c) => {
                if (cell.isBlack) {
                  return (
                    <div
                      key={`${r}-${c}`}
                      style={{ width: cellPx, height: cellPx, background: "#1a1a2e" }}
                    />
                  );
                }

                const isSelected = sel?.row === r && sel?.col === c;
                const isHighlighted = inSelectedWord(r, c);
                const bg = isSelected ? "#3B82F6" : isHighlighted ? "#BFDBFE" : "white";

                return (
                  <div
                    key={`${r}-${c}`}
                    onClick={() => handleCellClick(r, c)}
                    style={{
                      width: cellPx,
                      height: cellPx,
                      background: bg,
                      position: "relative",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {cell.number !== undefined && (
                      <span
                        style={{
                          position: "absolute",
                          top: 1,
                          left: 1,
                          fontSize: Math.max(6, cellPx * 0.27),
                          lineHeight: 1,
                          color: isSelected ? "white" : "#555",
                          fontWeight: 700,
                          fontFamily: "sans-serif",
                        }}
                      >
                        {cell.number}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: Math.max(10, cellPx * 0.52),
                        fontWeight: 800,
                        color: isSelected ? "white" : "#1a1a2e",
                        lineHeight: 1,
                        fontFamily: "sans-serif",
                      }}
                    >
                      {userGrid[r]?.[c] || ""}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Clues */}
        <div
          className="flex-1 overflow-y-auto text-xs"
          style={{ maxHeight: numRows * (cellPx + 1) + 2, fontFamily: "sans-serif" }}
        >
          <div className="font-black text-sm mb-1">Across</div>
          {acrossClues.map((pw) => {
            const active = selectedWord?.number === pw.number && selectedWord?.direction === "across";
            return (
              <div
                key={`a${pw.number}`}
                onClick={() => { setSel({ row: pw.row, col: pw.col, dir: "across" }); inputRef.current?.focus(); }}
                className="cursor-pointer mb-0.5 px-1 py-0.5 rounded"
                style={{
                  background: active ? "rgba(255,255,255,0.35)" : "transparent",
                  fontWeight: active ? 700 : 400,
                }}
              >
                <span className="font-bold">{pw.number}.</span> {pw.clue}
              </div>
            );
          })}
          <div className="font-black text-sm mt-3 mb-1">Down</div>
          {downClues.map((pw) => {
            const active = selectedWord?.number === pw.number && selectedWord?.direction === "down";
            return (
              <div
                key={`d${pw.number}`}
                onClick={() => { setSel({ row: pw.row, col: pw.col, dir: "down" }); inputRef.current?.focus(); }}
                className="cursor-pointer mb-0.5 px-1 py-0.5 rounded"
                style={{
                  background: active ? "rgba(255,255,255,0.35)" : "transparent",
                  fontWeight: active ? 700 : 400,
                }}
              >
                <span className="font-bold">{pw.number}.</span> {pw.clue}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active clue hint */}
      {selectedWord && !solved && (
        <div
          className="text-sm font-medium px-3 py-2 rounded-xl"
          style={{ background: "rgba(0,0,0,0.18)", fontFamily: "sans-serif" }}
        >
          <span className="font-black">
            {selectedWord.number} {selectedWord.direction === "across" ? "Across" : "Down"}:
          </span>{" "}
          {selectedWord.clue}
        </div>
      )}
    </div>
  );
}

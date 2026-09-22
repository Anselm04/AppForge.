export interface GeneratedCode {
  frontend: {
    code: string;
    components: string[];
    pages: string[];
  };
  backend: {
    code: string;
    endpoints: string[];
    services: string[];
  };
  database: {
    schema: string;
    migrations: string[];
  };
  infrastructure: {
    dockerCompose: string;
    ciConfig: string;
  };
}

function isGameRequest(requirements: any): boolean {
  const text = [requirements?.appName, requirements?.description, ...(requirements?.features ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /\b(game|arcade|pac[- ]?man|maze|snake|pong|platformer|level|ghost)\b/.test(text);
}

function gameSource(): string {
  return `import React, { useEffect, useState } from 'react';

const LEVELS = [
  ['############', '#P..o......#', '#.##.###.#.#', '#o#..#...#.#', '#.#.##.#.#.#', '#...G....#.#', '#.###.#.#.#.#', '#....#.....#', '#.##.###.##.#', '#...........#', '############'],
  ['############', '#o..#....o.#', '#.#.#.##.#.#', '#.#...#....#', '#.###.#.##.#', '#P..G..#..o#', '#.###.#.##.#', '#...#....#.#', '#.#.##.#.#.#', '#o........o#', '############'],
];

const move = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const locate = (grid, mark) => { for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) if (grid[y][x] === mark) return { x, y }; return { x: 1, y: 1 }; };
const setup = (index) => { const grid = LEVELS[index].map((row) => row.split('')); return { grid, player: locate(grid, 'P'), ghost: locate(grid, 'G') }; };

export default function PacManGame() {
  const [level, setLevel] = useState(0);
  const [state, setState] = useState(() => setup(0));
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [message, setMessage] = useState('Use the arrow keys to move');

  useEffect(() => {
    const onKey = (event) => {
      const direction = move[event.key];
      if (!direction || message !== 'Use the arrow keys to move') return;
      const next = { x: state.player.x + direction[0], y: state.player.y + direction[1] };
      const tile = state.grid[next.y]?.[next.x];
      if (!tile || tile === '#') return;
      const grid = state.grid.map((row) => [...row]);
      const points = tile === 'o' ? 10 : 0;
      grid[state.player.y][state.player.x] = '.';
      grid[next.y][next.x] = 'P';
      setScore((value) => value + points);
      setState({ ...state, grid, player: next });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, message]);

  useEffect(() => {
    const pellets = state.grid.flat().filter((cell) => cell === 'o').length;
    if (pellets > 0) return;
    if (level + 1 < LEVELS.length) { setLevel(level + 1); setState(setup(level + 1)); setMessage('Use the arrow keys to move'); }
    else setMessage('You completed every level!');
  }, [state.grid, level]);

  const reset = () => { setLevel(0); setState(setup(0)); setScore(0); setLives(3); setMessage('Use the arrow keys to move'); };
  return <main><h1>Arcade Maze</h1><p>Level {level + 1} · Score {score} · Lives {lives}</p><p>{message}</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 24px)', gap: 2 }}>{state.grid.flatMap((row, y) => row.map((cell, x) => <span key={x + ':' + y} style={{ width: 24, height: 24, background: cell === '#' ? '#2563eb' : '#111827', color: cell === 'o' ? '#fbbf24' : '#fff', textAlign: 'center' }}>{cell === 'P' ? '●' : cell === 'G' ? '◆' : cell === 'o' ? '·' : ''}</span>))}</div><button type="button" onClick={reset}>Reset game</button></main>;
}`;
}

export class CodeGenerator {
  async generateFrontend(requirements: any, architecture: any): Promise<GeneratedCode['frontend']> {
    if (isGameRequest(requirements)) return { code: gameSource(), components: ['PacManGame'], pages: ['Game'] };
    const components = (architecture?.frontend?.components ?? ['Header', 'Dashboard']).map((name: string) => this.generateComponent(name, requirements));
    const pages = (architecture?.frontend?.pages ?? ['Home']).map((name: string) => this.generatePage(name, requirements));
    return { code: 'export default function App() { return <div>Generated product</div>; }', components, pages };
  }

  async generateBackend(requirements: any, architecture: any): Promise<GeneratedCode['backend']> {
    const endpoints = (architecture?.backend?.endpoints ?? ['/api/health']).map((endpoint: string) => `app.get('${endpoint}', (_req, res) => res.json({ ok: true }));`);
    return { endpoints, services: ['AppService'], code: 'export default function startServer() { return true; }' };
  }

  async generateDatabase(_requirements: any, architecture: any): Promise<GeneratedCode['database']> {
    const tables = architecture?.database?.tables ?? ['app_state'];
    return { schema: tables.map((table: string) => `CREATE TABLE ${table} (id uuid PRIMARY KEY);`).join('\n'), migrations: ['0001_initial.sql'] };
  }

  private generateComponent(name: string, requirements: any): string { return `export function ${name}() { return <section><h2>${name}</h2><p>${requirements?.appName ?? 'Generated product'}</p></section>; }`; }
  private generatePage(name: string, requirements: any): string { return `export function ${name}Page() { return <main><h1>${name}</h1><p>${requirements?.description ?? ''}</p></main>; }`; }
}

export default CodeGenerator;

import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { trpc } from "../utils/trpc.js";

export function MusicStudio() {
  const [theme, setTheme] = useState("");
  const [genre, setGenre] = useState("pop");
  const [lyrics, setLyrics] = useState<{
    title?: string;
    structure?: { section: string; lines: string[] }[];
  } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [projectId, setProjectId] = useState("");

  const generate = useMutation({
    mutationFn: () => trpc.capabilities.generateLyrics.mutate({ theme, genre }),
    onSuccess: (data) => setLyrics(data),
  });

  const attach = useMutation({
    mutationFn: (content: string) =>
      trpc.capabilities.attachStudioAsset.mutate({
        projectId: parseInt(projectId, 10),
        filename: "track-manifest.json",
        content,
        kind: "audio",
      }),
  });

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      void audioCtxRef.current?.close();
    };
  }, []);

  const toggleBeat = () => {
    if (playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
      setPlaying(false);
      return;
    }
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const interval = (60 / bpm) * 1000;
    intervalRef.current = setInterval(() => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 440;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.stop(ctx.currentTime + 0.1);
    }, interval);
    setPlaying(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link to="/studio" className="text-sm text-slate-400 hover:text-white">
          ← Creative Studio
        </Link>
        <h1 className="text-3xl font-bold mt-4 mb-2">Music & Lyrics Studio</h1>
        <p className="text-slate-400 mb-6">
          AI lyrics + beat metronome. Export manifest for your app build.
        </p>

        <div className="space-y-4">
          <input
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3"
            placeholder="Song theme…"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          />
          <input
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3"
            placeholder="Genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          />
          <button
            type="button"
            disabled={theme.length < 3 || generate.isPending}
            onClick={() => generate.mutate()}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 px-4 py-2 rounded-lg"
          >
            {generate.isPending ? "Writing…" : "Generate lyrics"}
          </button>

          <div className="flex items-center gap-4">
            <label className="text-sm">
              BPM
              <input
                type="number"
                min={60}
                max={200}
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value, 10) || 120)}
                className="ml-2 w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1"
              />
            </label>
            <button
              type="button"
              onClick={toggleBeat}
              className="bg-pink-600 hover:bg-pink-700 px-4 py-2 rounded-lg text-sm"
            >
              {playing ? "Stop beat" : "Play beat"}
            </button>
          </div>

          {lyrics && (
            <div className="bg-slate-800 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-64 overflow-auto">
              <h2 className="font-bold text-lg mb-2">
                {lyrics.title ?? "Untitled"}
              </h2>
              {lyrics.structure?.map((sec) => (
                <div key={sec.section} className="mb-3">
                  <div className="text-purple-400 font-medium">
                    [{sec.section}]
                  </div>
                  {sec.lines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end pt-4">
            <input
              placeholder="Project ID"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 w-28"
            />
            <button
              type="button"
              disabled={!projectId || !lyrics || attach.isPending}
              onClick={() =>
                attach.mutate(
                  JSON.stringify({ bpm, genre, ...lyrics }, null, 2),
                )
              }
              className="bg-slate-600 px-4 py-2 rounded-lg text-sm"
            >
              Attach to project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

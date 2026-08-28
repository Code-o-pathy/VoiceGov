"use client";

export type OrbMode =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "confirm";

const MODE_RING: Record<OrbMode, string> = {
  idle: "from-indigo-500 to-violet-600",
  listening: "from-rose-500 to-red-600",
  thinking: "from-amber-400 to-orange-500",
  speaking: "from-emerald-400 to-teal-500",
  confirm: "from-amber-400 to-orange-500",
};

/** Animated assistant avatar that reflects VoiceGov's current mode. */
export function VoiceOrb({
  mode,
  onClick,
  size = 64,
  level = 0,
}: {
  mode: OrbMode;
  onClick?: () => void;
  size?: number;
  /** Live mic level 0..1 — the orb grows and glows as it hears you. */
  level?: number;
}) {
  const listening = mode === "listening";
  // Grow the orb up to +40% with voice level; keep steady otherwise.
  const scale = listening ? 1 + level * 0.4 : 1;
  const glow = listening ? 0.35 + level * 0.6 : 0;

  return (
    <button
      onClick={onClick}
      aria-label="VoiceGov assistant"
      className="relative flex items-center justify-center rounded-full shadow-xl transition-transform duration-100 active:scale-95"
      style={{
        width: size,
        height: size,
        transform: `scale(${scale})`,
        boxShadow: glow
          ? `0 0 ${12 + level * 40}px ${4 + level * 12}px rgba(244,63,94,${glow})`
          : undefined,
      }}
    >
      {/* Live level ring when listening */}
      {listening && (
        <>
          <span
            className="absolute rounded-full bg-rose-500/25"
            style={{
              inset: -8 - level * 22,
              transition: "inset 0.08s ease-out",
            }}
          />
          <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/20" />
        </>
      )}
      {mode === "speaking" && (
        <span className="absolute -inset-1 animate-pulse rounded-full border-2 border-emerald-400/50" />
      )}

      <span
        className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ${MODE_RING[mode]} text-white`}
      >
        {mode === "thinking" ? (
          <span
            className="rounded-full border-2 border-white/40 border-t-white animate-spin"
            style={{ width: size * 0.4, height: size * 0.4 }}
          />
        ) : mode === "speaking" ? (
          <SoundWave />
        ) : (
          <MicIcon size={size * 0.42} />
        )}
      </span>
    </button>
  );
}

function MicIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SoundWave() {
  return (
    <span className="flex items-end gap-0.5" style={{ height: 20 }}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-white"
          style={{
            height: 8 + (i % 2) * 8,
            animation: `vg-bar 0.8s ease-in-out ${i * 0.12}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

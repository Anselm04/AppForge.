import { useMemo, useState, type ReactNode } from "react";
import {
  createSpeechRecognition,
  speechRecognitionSupported,
  transcriptFromSpeechResult,
} from "../lib/speechInput.js";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  submitLabel: string;
  placeholder: string;
  suggestions?: readonly string[];
  disabled?: boolean;
  submitDisabled?: boolean;
  busy?: boolean;
  maxLength?: number;
  label?: string;
  helperText?: string;
  submitTestId?: string;
  textareaTestId?: string;
  children?: ReactNode;
};

export function BuildPromptComposer({
  value,
  onChange,
  onSubmit,
  submitLabel,
  placeholder,
  suggestions = [],
  disabled = false,
  submitDisabled = false,
  busy = false,
  maxLength,
  label = "What do you want to build?",
  helperText,
  submitTestId,
  textareaTestId,
  children,
}: Props) {
  const [listening, setListening] = useState(false);
  const voiceSupported = useMemo(() => speechRecognitionSupported(), []);

  const startVoiceInput = () => {
    const recognition = createSpeechRecognition();
    if (!recognition) return;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = document.documentElement.lang || "en";
    recognition.onresult = (event) => {
      const transcript = transcriptFromSpeechResult(event);
      if (!transcript) return;
      onChange(`${value.trim()}${value.trim() ? " " : ""}${transcript}`);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    setListening(true);
    recognition.start();
  };

  return (
    <form
      onSubmit={onSubmit}
      data-testid="build-prompt-form"
      className="space-y-4"
    >
      <div className="rounded-3xl border border-forge-border bg-forge-surface shadow-(--forge-shadow-soft) transition-[border-color,box-shadow] focus-within:border-forge-gold/50 focus-within:shadow-[0_20px_60px_rgba(37,42,50,0.12)]">
        <label className="sr-only" htmlFor="appforge-build-prompt">
          {label}
        </label>
        <textarea
          id="appforge-build-prompt"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled || busy}
          data-testid={textareaTestId}
          className="min-h-36 w-full resize-none bg-transparent px-5 pt-5 text-base leading-7 text-forge-text-primary outline-none placeholder:text-forge-text-muted disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-40 sm:px-6 sm:pt-6"
        />

        {children && (
          <div className="space-y-4 border-t border-forge-border/70 px-4 py-4 sm:px-5">
            {children}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-forge-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startVoiceInput}
              disabled={!voiceSupported || disabled || busy || listening}
              aria-label={
                voiceSupported
                  ? listening
                    ? "Listening for voice input"
                    : "Start voice input"
                  : "Voice input unavailable"
              }
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-forge-border bg-forge-bg text-forge-text-primary transition hover:border-forge-gold/60 hover:bg-forge-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
              title={
                voiceSupported
                  ? "Speak your product idea"
                  : "Voice input is not supported by this browser"
              }
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
              </svg>
            </button>
            <span className="text-xs text-forge-text-muted">
              {listening ? "Listening…" : "Type or speak your idea"}
            </span>
          </div>

          <button
            type="submit"
            disabled={disabled || submitDisabled || busy || !value.trim()}
            data-testid={submitTestId}
            className="forge-gold-btn inline-flex min-h-11 items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
              />
            )}
            {submitLabel}
          </button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Build suggestions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={disabled || busy}
              onClick={() => onChange(suggestion)}
              className="rounded-full border border-forge-border bg-forge-surface/75 px-3.5 py-2 text-xs font-medium text-forge-text-muted transition hover:border-forge-gold/50 hover:text-forge-text-primary disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {helperText && (
        <p className="text-xs leading-5 text-forge-text-muted">{helperText}</p>
      )}
    </form>
  );
}

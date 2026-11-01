export type SpeechRecognitionResultEventLike = {
  results?: ArrayLike<
    ArrayLike<{
      transcript?: string;
    }>
  >;
};

export type BrowserSpeechRecognition = {
  start: () => void;
  stop: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function createSpeechRecognition(): BrowserSpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechWindow;
  const Recognition =
    speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  if (!Recognition) return null;
  return new Recognition();
}

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const speechWindow = window as SpeechWindow;
  return Boolean(
    speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition,
  );
}

export function transcriptFromSpeechResult(
  event: SpeechRecognitionResultEventLike,
): string {
  const result = event.results?.[0];
  const alternative = result?.[0];
  return alternative?.transcript?.trim() ?? "";
}

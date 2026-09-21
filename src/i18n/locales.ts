export const LOCALE_STORAGE_KEY = "appforge.locale";

export const LOCALES = [
  { code: "en", nativeName: "English", dir: "ltr" },
  { code: "mi", nativeName: "Māori", dir: "ltr" },
  { code: "af", nativeName: "Afrikaans", dir: "ltr" },
  { code: "sq", nativeName: "Shqip", dir: "ltr" },
  { code: "am", nativeName: "አማርኛ", dir: "ltr" },
  { code: "ar", nativeName: "العربية", dir: "rtl" },
  { code: "hy", nativeName: "Հայերեն", dir: "ltr" },
  { code: "az", nativeName: "Azərbaycanca", dir: "ltr" },
  { code: "eu", nativeName: "Euskara", dir: "ltr" },
  { code: "be", nativeName: "Беларуская", dir: "ltr" },
  { code: "bn", nativeName: "বাংলা", dir: "ltr" },
  { code: "bs", nativeName: "Bosanski", dir: "ltr" },
  { code: "bg", nativeName: "Български", dir: "ltr" },
  { code: "ca", nativeName: "Català", dir: "ltr" },
  { code: "ceb", nativeName: "Cebuano", dir: "ltr" },
  { code: "zh", nativeName: "中文", dir: "ltr" },
  { code: "co", nativeName: "Corsu", dir: "ltr" },
  { code: "hr", nativeName: "Hrvatski", dir: "ltr" },
  { code: "cs", nativeName: "Čeština", dir: "ltr" },
  { code: "da", nativeName: "Dansk", dir: "ltr" },
  { code: "nl", nativeName: "Nederlands", dir: "ltr" },
  { code: "eo", nativeName: "Esperanto", dir: "ltr" },
  { code: "et", nativeName: "Eesti", dir: "ltr" },
  { code: "fi", nativeName: "Suomi", dir: "ltr" },
  { code: "fr", nativeName: "Français", dir: "ltr" },
  { code: "fy", nativeName: "Frysk", dir: "ltr" },
  { code: "gl", nativeName: "Galego", dir: "ltr" },
  { code: "ka", nativeName: "ქართული", dir: "ltr" },
  { code: "de", nativeName: "Deutsch", dir: "ltr" },
  { code: "el", nativeName: "Ελληνικά", dir: "ltr" },
  { code: "gu", nativeName: "ગુજરાતી", dir: "ltr" },
  { code: "ht", nativeName: "Kreyòl ayisyen", dir: "ltr" },
  { code: "ha", nativeName: "Hausa", dir: "ltr" },
  { code: "haw", nativeName: "ʻŌlelo Hawaiʻi", dir: "ltr" },
  { code: "he", nativeName: "עברית", dir: "rtl" },
  { code: "hi", nativeName: "हिन्दी", dir: "ltr" },
  { code: "hmn", nativeName: "Hmong", dir: "ltr" },
  { code: "hu", nativeName: "Magyar", dir: "ltr" },
  { code: "is", nativeName: "Íslenska", dir: "ltr" },
  { code: "ig", nativeName: "Igbo", dir: "ltr" },
  { code: "id", nativeName: "Bahasa Indonesia", dir: "ltr" },
  { code: "ga", nativeName: "Gaeilge", dir: "ltr" },
  { code: "it", nativeName: "Italiano", dir: "ltr" },
  { code: "ja", nativeName: "日本語", dir: "ltr" },
  { code: "jv", nativeName: "Basa Jawa", dir: "ltr" },
  { code: "kn", nativeName: "ಕನ್ನಡ", dir: "ltr" },
  { code: "kk", nativeName: "Қазақша", dir: "ltr" },
  { code: "km", nativeName: "ខ្មែរ", dir: "ltr" },
  { code: "rw", nativeName: "Kinyarwanda", dir: "ltr" },
  { code: "ko", nativeName: "한국어", dir: "ltr" },
  { code: "ku", nativeName: "Kurdî", dir: "ltr" },
  { code: "ky", nativeName: "Кыргызча", dir: "ltr" },
  { code: "lo", nativeName: "ລາວ", dir: "ltr" },
  { code: "la", nativeName: "Latina", dir: "ltr" },
  { code: "lv", nativeName: "Latviešu", dir: "ltr" },
  { code: "lt", nativeName: "Lietuvių", dir: "ltr" },
  { code: "lb", nativeName: "Lëtzebuergesch", dir: "ltr" },
  { code: "mk", nativeName: "Македонски", dir: "ltr" },
  { code: "mg", nativeName: "Malagasy", dir: "ltr" },
  { code: "ms", nativeName: "Bahasa Melayu", dir: "ltr" },
  { code: "ml", nativeName: "മലയാളം", dir: "ltr" },
  { code: "mt", nativeName: "Malti", dir: "ltr" },
  { code: "mn", nativeName: "Монгол", dir: "ltr" },
  { code: "my", nativeName: "မြန်မာ", dir: "ltr" },
  { code: "ne", nativeName: "नेपाली", dir: "ltr" },
  { code: "no", nativeName: "Norsk", dir: "ltr" },
  { code: "ny", nativeName: "Chichewa", dir: "ltr" },
  { code: "or", nativeName: "ଓଡ଼ିଆ", dir: "ltr" },
  { code: "ps", nativeName: "پښتو", dir: "rtl" },
  { code: "fa", nativeName: "فارسی", dir: "rtl" },
  { code: "pl", nativeName: "Polski", dir: "ltr" },
  { code: "pt", nativeName: "Português", dir: "ltr" },
  { code: "pa", nativeName: "ਪੰਜਾਬੀ", dir: "ltr" },
  { code: "ro", nativeName: "Română", dir: "ltr" },
  { code: "ru", nativeName: "Русский", dir: "ltr" },
  { code: "sm", nativeName: "Gagana Samoa", dir: "ltr" },
  { code: "gd", nativeName: "Gàidhlig", dir: "ltr" },
  { code: "sr", nativeName: "Српски", dir: "ltr" },
  { code: "st", nativeName: "Sesotho", dir: "ltr" },
  { code: "sn", nativeName: "Shona", dir: "ltr" },
  { code: "sd", nativeName: "سنڌي", dir: "rtl" },
  { code: "si", nativeName: "සිංහල", dir: "ltr" },
  { code: "sk", nativeName: "Slovenčina", dir: "ltr" },
  { code: "sl", nativeName: "Slovenščina", dir: "ltr" },
  { code: "so", nativeName: "Soomaali", dir: "ltr" },
  { code: "es", nativeName: "Español", dir: "ltr" },
  { code: "su", nativeName: "Basa Sunda", dir: "ltr" },
  { code: "sw", nativeName: "Kiswahili", dir: "ltr" },
  { code: "sv", nativeName: "Svenska", dir: "ltr" },
  { code: "tl", nativeName: "Filipino", dir: "ltr" },
  { code: "tg", nativeName: "Тоҷикӣ", dir: "ltr" },
  { code: "ta", nativeName: "தமிழ்", dir: "ltr" },
  { code: "tt", nativeName: "Татарча", dir: "ltr" },
  { code: "te", nativeName: "తెలుగు", dir: "ltr" },
  { code: "th", nativeName: "ไทย", dir: "ltr" },
  { code: "tr", nativeName: "Türkçe", dir: "ltr" },
  { code: "tk", nativeName: "Türkmençe", dir: "ltr" },
  { code: "uk", nativeName: "Українська", dir: "ltr" },
  { code: "ur", nativeName: "اردو", dir: "rtl" },
  { code: "ug", nativeName: "ئۇيغۇرچە", dir: "rtl" },
  { code: "uz", nativeName: "O‘zbekcha", dir: "ltr" },
  { code: "vi", nativeName: "Tiếng Việt", dir: "ltr" },
  { code: "cy", nativeName: "Cymraeg", dir: "ltr" },
  { code: "xh", nativeName: "isiXhosa", dir: "ltr" },
  { code: "yi", nativeName: "ייִדיש", dir: "rtl" },
  { code: "yo", nativeName: "Yorùbá", dir: "ltr" },
  { code: "zu", nativeName: "isiZulu", dir: "ltr" },
  { code: "as", nativeName: "অসমীয়া", dir: "ltr" },
  { code: "ay", nativeName: "Aymar aru", dir: "ltr" },
  { code: "bm", nativeName: "Bamanankan", dir: "ltr" },
  { code: "bho", nativeName: "भोजपुरी", dir: "ltr" },
  { code: "dv", nativeName: "ދިވެހި", dir: "rtl" },
  { code: "doi", nativeName: "डोगरी", dir: "ltr" },
  { code: "ee", nativeName: "Eʋegbe", dir: "ltr" },
  { code: "gn", nativeName: "Avañe'ẽ", dir: "ltr" },
  { code: "ilo", nativeName: "Ilokano", dir: "ltr" },
  { code: "kri", nativeName: "Krio", dir: "ltr" },
  { code: "ln", nativeName: "Lingála", dir: "ltr" },
  { code: "lg", nativeName: "Luganda", dir: "ltr" },
  { code: "mai", nativeName: "मैथिली", dir: "ltr" },
  { code: "mni", nativeName: "মৈতৈলোন্", dir: "ltr" },
  { code: "om", nativeName: "Afaan Oromoo", dir: "ltr" },
  { code: "qu", nativeName: "Runasimi", dir: "ltr" },
  { code: "sa", nativeName: "संस्कृतम्", dir: "ltr" },
  { code: "nso", nativeName: "Sepedi", dir: "ltr" },
  { code: "ti", nativeName: "ትግርኛ", dir: "ltr" },
  { code: "ts", nativeName: "itsonga", dir: "ltr" },
  { code: "ak", nativeName: "Twi", dir: "ltr" },
  { code: "ba", nativeName: "Башҡортса", dir: "ltr" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];
export type TextDir = (typeof LOCALES)[number]["dir"];

export const DEFAULT_LOCALE: LocaleCode = "en";

const LOCALE_CODES: readonly LocaleCode[] = LOCALES.map((l) => l.code);

export function isLocaleCode(value: string): value is LocaleCode {
  return (LOCALE_CODES as readonly string[]).includes(value);
}

export function getLocaleMeta(code: LocaleCode) {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}

/** Map navigator.language (e.g. en-NZ, zh-CN, pt-BR) onto a supported locale. */
export function matchNavigatorLanguage(language: string | undefined | null): LocaleCode {
  if (!language) return DEFAULT_LOCALE;
  const lower = language.toLowerCase().replace(/_/g, "-");
  const exact = LOCALES.find((l) => l.code === lower);
  if (exact) return exact.code;
  const prefix = lower.split("-")[0];
  if (prefix && isLocaleCode(prefix)) return prefix;
  return DEFAULT_LOCALE;
}

export function detectLocale(): LocaleCode {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocaleCode(stored)) return stored;
  } catch {
    /* private mode / blocked storage */
  }
  const nav =
    window.navigator?.language ||
    (window.navigator as Navigator & { userLanguage?: string }).userLanguage;
  return matchNavigatorLanguage(nav);
}

export function applyDocumentLocale(code: LocaleCode) {
  if (typeof document === "undefined") return;
  try {
    const meta = getLocaleMeta(code);
    document.documentElement.lang = code;
    document.documentElement.dir = meta.dir;
    document.documentElement.setAttribute("data-locale", code);
  } catch {
    /* some WebKit builds reject html dir/lang writes during render */
  }
}

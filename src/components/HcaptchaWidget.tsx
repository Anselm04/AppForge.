import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    hcaptcha?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
        },
      ) => string;
      reset: (id?: string) => void;
    };
  }
}

type Props = {
  onToken: (token: string | null) => void;
};

export function HcaptchaWidget({ onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);

  useEffect(() => {
    const cfg = (
      window as Window & { __APPFORGE_CONFIG__?: { hcaptchaSiteKey?: string } }
    ).__APPFORGE_CONFIG__;
    const key =
      cfg?.hcaptchaSiteKey || import.meta.env.VITE_HCAPTCHA_SITE_KEY || "";
    if (key) setSiteKey(key);
  }, []);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const render = () => {
      if (!containerRef.current || !window.hcaptcha) return;
      widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(null),
      });
    };

    if (window.hcaptcha) {
      render();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.hcaptcha.com/1/api.js?render=explicit";
    script.async = true;
    script.onload = render;
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [siteKey, onToken]);

  if (!siteKey) return null;

  return (
    <div className="flex justify-center">
      <div ref={containerRef} />
    </div>
  );
}

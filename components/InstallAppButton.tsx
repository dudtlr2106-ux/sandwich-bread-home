"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }

    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setInstalled(standalone);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setPromptEvent(null);
      return;
    }

    window.alert("브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 눌러 설치할 수 있습니다.");
  }

  return (
    <button
      type="button"
      onClick={() => void install()}
      style={{
        border: "1px solid #d9cff5",
        background: "#f0ffd9",
        color: "#5e43bd",
        borderRadius: 10,
        padding: "9px 13px",
        fontSize: 14,
        fontWeight: 800,
      }}
    >
      앱 설치
    </button>
  );
}

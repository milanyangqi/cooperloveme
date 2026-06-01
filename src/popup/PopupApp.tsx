import { BookOpen, Mic, ShieldCheck } from "lucide-react";
import { useState } from "react";

type InjectResult = {
  href: string;
  title: string;
  videoCount: number;
};

type PanelResult = {
  mounted: boolean;
  videoCount: number;
};

type CaptionPanelResult = {
  started: boolean;
  videoCount: number;
  cueCount?: number;
  source?: string;
  error?: string;
};

function createMiniPanelScript() {
  const existing = document.getElementById("yll-mini-panel");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "yll-mini-panel";
  panel.style.cssText = [
    "position:fixed",
    "right:16px",
    "top:86px",
    "z-index:2147483647",
    "width:360px",
    "max-height:72vh",
    "overflow:auto",
    "background:#202224",
    "color:#f7f8f8",
    "border:1px solid rgba(255,255,255,.16)",
    "border-radius:8px",
    "box-shadow:0 16px 42px rgba(0,0,0,.28)",
    "font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"
  ].join(";");

  panel.innerHTML = `
    <div style="position:sticky;top:0;background:#202224;border-bottom:1px solid rgba(255,255,255,.12);padding:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <strong style="font-size:14px">YouTube Language Lab</strong>
        <button id="yll-mini-close" style="background:#2b2e32;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:6px;height:28px;padding:0 10px;cursor:pointer">关闭</button>
      </div>
      <div id="yll-mini-status" style="color:#a3aab5;margin-top:6px">面板已注入，等待读取任务...</div>
    </div>
    <div id="yll-mini-list" style="padding-bottom:10px"></div>
  `;
  document.documentElement.appendChild(panel);
  document.getElementById("yll-mini-close")?.addEventListener("click", () => panel.remove(), { once: true });
  return {
    mounted: true,
    videoCount: document.querySelectorAll("video").length
  };
}

function startVisibleCaptionCollectorScript() {
  type VisibleCue = {
    startMs: number;
    text: string;
    durationMs?: number;
  };
  const win = window as typeof window & {
    __yllVisibleCaptionTimer?: number;
    __yllVisibleCaptionRows?: VisibleCue[];
  };
  const status = document.getElementById("yll-mini-status");
  const list = document.getElementById("yll-mini-list");
  const video = document.querySelector("video");

  if (win.__yllVisibleCaptionTimer) {
    window.clearInterval(win.__yllVisibleCaptionTimer);
  }

  win.__yllVisibleCaptionRows = [];
  if (list) list.innerHTML = "";

  const cleanText = (value: string) => {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return textarea.value.trim();
  };
  const formatClock = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };
  const escapeHtml = (text: string) =>
    text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
  const readVisibleCaptionText = () => {
    const selectors = [
      ".ytp-caption-window-container .ytp-caption-segment",
      ".ytp-caption-window-container .captions-text",
      ".caption-window .ytp-caption-segment",
      ".caption-window .captions-text",
      ".ytp-caption-segment"
    ];
    return cleanText(selectors
      .flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => element.innerText || element.textContent || "")
      .join(" "));
  };
  const readTextTrackRows = () => {
    const currentVideo = document.querySelector("video");
    if (!currentVideo?.textTracks?.length) return [];
    const tracks = Array.from(currentVideo.textTracks);
    const target =
      tracks.find((track) => track.language?.startsWith("en") && (track.kind === "captions" || track.kind === "subtitles")) ??
      tracks.find((track) => track.kind === "captions" || track.kind === "subtitles") ??
      tracks[0];

    if (!target) return [];
    tracks.forEach((track) => {
      track.mode = track === target ? "hidden" : "disabled";
    });

    return Array.from(target.cues ?? [])
      .map((cue) => {
        const text = cleanText("text" in cue ? String(cue.text) : "");
        if (!text) return undefined;
        return {
          startMs: Math.max(0, Math.round(cue.startTime * 1000)),
          durationMs: Math.max(500, Math.round((cue.endTime - cue.startTime) * 1000)),
          text
        };
      })
      .filter(Boolean) as VisibleCue[];
  };
  const render = () => {
    if (!list) return;
    const rows = [...(win.__yllVisibleCaptionRows ?? [])].sort((a, b) => b.startMs - a.startMs);
    list.innerHTML = rows
      .map((cue) => `
        <button data-start="${cue.startMs}" style="display:grid;grid-template-columns:48px 1fr;gap:8px;width:100%;border:0;border-top:1px solid rgba(255,255,255,.08);background:transparent;color:inherit;text-align:left;padding:9px 12px;cursor:pointer">
          <span style="color:#ffc857;font-variant-numeric:tabular-nums">${formatClock(cue.startMs)}</span>
          <span>${escapeHtml(cue.text)}</span>
        </button>
      `)
      .join("");
    list.querySelectorAll<HTMLButtonElement>("button[data-start]").forEach((button) => {
      button.addEventListener("click", () => {
        const currentVideo = document.querySelector("video");
        if (!currentVideo) return;
        currentVideo.currentTime = Number(button.dataset.start ?? "0") / 1000;
        void currentVideo.play();
      });
    });
    list.scrollTop = 0;
  };
  const capture = () => {
    const text = readVisibleCaptionText();
    const rows = win.__yllVisibleCaptionRows ?? [];
    if (!text) {
      if (status) status.textContent = rows.length
        ? `已采集 ${rows.length} 条可见字幕，等待下一句...`
        : "正在采集画面字幕，请确认 YouTube CC 字幕已显示。";
      return;
    }

    const last = rows[rows.length - 1];
    if (last?.text === text) {
      if (status) status.textContent = `已采集 ${rows.length} 条可见字幕，当前句同步中...`;
      return;
    }

    rows.push({
      startMs: Math.max(0, Math.round((video?.currentTime ?? 0) * 1000)),
      text
    });
    win.__yllVisibleCaptionRows = rows
      .filter((cue, index, all) => all.findIndex((item) => item.startMs === cue.startMs && item.text === cue.text) === index)
      .slice(-240);
    if (status) status.textContent = `已采集 ${win.__yllVisibleCaptionRows.length} 条可见字幕`;
    render();
  };

  const fullRows = readTextTrackRows();
  if (fullRows.length) {
    win.__yllVisibleCaptionRows = fullRows;
    if (status) status.textContent = `已加载 ${fullRows.length} 条字幕，当前句会同步到顶部...`;
    render();
  } else {
    capture();
  }
  win.__yllVisibleCaptionTimer = window.setInterval(capture, 500);

  return {
    started: true,
    videoCount: document.querySelectorAll("video").length,
    cueCount: win.__yllVisibleCaptionRows.length,
    source: fullRows.length ? "video.textTracks full captions" : "visible YouTube captions"
  };
}

export function PopupApp() {
  const [status, setStatus] = useState("安全模式：打开插件不会自动读取页面。");

  const runSafePageProbe = async () => {
    try {
      setStatus("正在检测当前 YouTube 页面...");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url) {
        setStatus("没有找到当前标签页。");
        return;
      }

      const parsed = new URL(tab.url);
      if (!parsed.hostname.includes("youtube.com")) {
        setStatus("请先切换到 YouTube 页面。");
        return;
      }

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: () => ({
          href: location.href,
          title: document.title,
          videoCount: document.querySelectorAll("video").length
        })
      });
      const payload = result?.result as InjectResult | undefined;
      setStatus(payload ? `页面正常：检测到 ${payload.videoCount} 个视频元素。` : "页面已连接，但没有返回检测结果。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "页面检测失败。");
    }
  };

  const mountMiniPanel = async () => {
    try {
      setStatus("正在注入最小字幕面板...");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url) {
        setStatus("没有找到当前标签页。");
        return;
      }

      const parsed = new URL(tab.url);
      if (!parsed.hostname.includes("youtube.com")) {
        setStatus("请先切换到 YouTube 页面。");
        return;
      }

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: createMiniPanelScript
      });
      const payload = result?.result as PanelResult | undefined;
      setStatus(payload?.mounted ? `最小面板已注入，视频元素 ${payload.videoCount} 个。` : "面板注入没有返回结果。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "面板注入失败。");
    }
  };

  const loadMiniCaptions = async () => {
    try {
      setStatus("正在读取当前视频字幕...");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url) {
        setStatus("没有找到当前标签页。");
        return;
      }

      const parsed = new URL(tab.url);
      if (!parsed.hostname.includes("youtube.com") || parsed.pathname !== "/watch") {
        setStatus("请先切换到 YouTube 视频播放页。");
        return;
      }

      const [shellResult] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: createMiniPanelScript
      });
      const shellPayload = shellResult?.result as PanelResult | undefined;
      if (!shellPayload?.mounted) {
        setStatus("字幕面板没有成功注入。");
        return;
      }
      setStatus(`字幕面板已注入，视频元素 ${shellPayload.videoCount} 个，正在读取...`);

      const [visibleResult] = await chrome.scripting.executeScript<[], CaptionPanelResult>({
        target: { tabId: tab.id },
        func: startVisibleCaptionCollectorScript
      });
      const visiblePayload = visibleResult?.result as CaptionPanelResult | undefined;
      setStatus(visiblePayload?.started
        ? `已启动可见字幕采集，视频元素 ${visiblePayload.videoCount} 个。`
        : "可见字幕采集没有返回结果。");
      return;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "字幕读取失败。");
    }
  };

  return (
    <main className="popup">
      <header className="popup-header">
        <div>
          <h1>YouTube Language Lab</h1>
          <p>{status}</p>
        </div>
      </header>

      <section className="hero-panel">
        <div className="hero-icon">
          <Mic size={24} />
        </div>
        <div>
          <strong>全屏混合练习</strong>
          <span>跟读评分、听写、填空、理解选择</span>
        </div>
      </section>

      <div className="action-grid">
        <button type="button" onClick={runSafePageProbe}>
          <BookOpen size={17} />
          检测页面
        </button>
        <button type="button" onClick={mountMiniPanel}>
          <BookOpen size={17} />
          注入面板
        </button>
        <button type="button" onClick={loadMiniCaptions}>
          <BookOpen size={17} />
          读取字幕
        </button>
      </div>

      <section className="account-card">
        <div>
          <span className="label">当前版本</span>
          <strong>0.1.21 自动面板</strong>
          <p>打开 YouTube 视频页会自动加载轻量字幕面板；按钮仍保留用于手动诊断。</p>
        </div>
        <span className="plan">
          <ShieldCheck size={13} />
          SAFE
        </span>
      </section>
    </main>
  );
}

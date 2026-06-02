import { BookOpen, Mic, ShieldCheck } from "lucide-react";
import { useState } from "react";

type InjectResult = {
  href: string;
  title: string;
  videoCount: number;
};

export function PopupApp() {
  const [status, setStatus] = useState("自动模式：YouTube 视频页会加载新版轻量字幕面板。");

  const wakeSafeContentScript = async (message: string) => {
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

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["assets/content.js"]
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.dispatchEvent(new Event("yll-safe-reload"))
    });
    setStatus(message);
  };

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
      setStatus("正在唤醒新版字幕面板...");
      await wakeSafeContentScript("新版字幕面板已唤醒，正在自动读取官方字幕。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "面板注入失败。");
    }
  };

  const loadMiniCaptions = async () => {
    try {
      setStatus("正在唤醒新版字幕读取任务...");
      await wakeSafeContentScript("新版字幕读取任务已唤醒，不再使用旧的手动采集器。");
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
          唤醒面板
        </button>
        <button type="button" onClick={loadMiniCaptions}>
          <BookOpen size={17} />
          重读字幕
        </button>
      </div>

      <section className="account-card">
        <div>
          <span className="label">当前版本</span>
          <strong>0.1.66 待审核</strong>
          <p>修复查词弹窗在收藏前被自动隐藏的问题。</p>
        </div>
        <span className="plan">
          <ShieldCheck size={13} />
          SAFE
        </span>
      </section>
    </main>
  );
}

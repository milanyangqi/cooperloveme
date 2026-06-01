import { createRoot } from "react-dom/client";
import { ContentApp } from "./components/ContentApp";
import styles from "./styles.css?inline";

const HOST_ID = "youtube-language-lab-root";

function isWatchPage() {
  return window.location.hostname.includes("youtube.com") && window.location.pathname === "/watch";
}

function mount() {
  if (!isWatchPage()) {
    document.getElementById(HOST_ID)?.remove();
    return;
  }

  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = styles;
  const root = document.createElement("div");
  shadow.append(style, root);
  document.documentElement.append(host);
  createRoot(root).render(<ContentApp />);
}

mount();

let lastUrl = window.location.href;
const remountOnUrlChange = () => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    const host = document.getElementById(HOST_ID);
    host?.remove();
    if (isWatchPage()) window.setTimeout(mount, 800);
  }
};

window.addEventListener("yt-navigate-finish", remountOnUrlChange);
window.addEventListener("popstate", remountOnUrlChange);
if (isWatchPage()) window.setInterval(remountOnUrlChange, 1000);

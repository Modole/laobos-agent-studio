const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      --pi-agent-accent: #181817;
      --pi-agent-panel: #ffffff;
      --pi-agent-radius: 18px;
      position: fixed;
      z-index: 2147483000;
      right: 20px;
      bottom: 20px;
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    .launcher {
      display: grid;
      width: 54px;
      height: 54px;
      place-items: center;
      border: 1px solid rgb(255 255 255 / 0.14);
      border-radius: 17px;
      background: var(--pi-agent-accent);
      box-shadow: 0 13px 36px rgb(20 20 18 / 0.24);
      color: #fff;
      cursor: pointer;
      font-family: Georgia, serif;
      font-size: 25px;
      transition: transform 160ms ease, border-radius 160ms ease, box-shadow 160ms ease;
    }
    .launcher:hover {
      box-shadow: 0 16px 42px rgb(20 20 18 / 0.3);
      transform: translateY(-2px);
    }
    .launcher:focus-visible {
      outline: 3px solid rgb(103 103 218 / 0.32);
      outline-offset: 3px;
    }
    .panel {
      position: absolute;
      right: 0;
      bottom: 68px;
      display: none;
      width: min(var(--pi-agent-width, 440px), calc(100vw - 24px));
      height: min(var(--pi-agent-height, 680px), calc(100vh - 104px));
      overflow: hidden;
      border: 1px solid #d8d7d2;
      border-radius: var(--pi-agent-radius);
      background: var(--pi-agent-panel);
      box-shadow: 0 24px 80px rgb(20 20 18 / 0.22);
      transform-origin: right bottom;
    }
    :host([open]) .panel {
      display: block;
      animation: panel-in 170ms ease-out;
    }
    :host([open]) .launcher {
      border-radius: 50%;
    }
    iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
      background: #fff;
    }
    @keyframes panel-in {
      from { opacity: 0; transform: translateY(8px) scale(.985); }
    }
    @media (max-width: 560px) {
      :host {
        right: 10px;
        bottom: 10px;
      }
      .launcher {
        width: 50px;
        height: 50px;
        border-radius: 15px;
      }
      .panel {
        position: fixed;
        inset: 8px 8px 70px;
        width: auto;
        height: auto;
        border-radius: 16px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .launcher, .panel { animation: none !important; transition: none !important; }
    }
  </style>
  <section class="panel" role="dialog" aria-label="劳博士">
    <iframe title="劳博士" loading="lazy"></iframe>
  </section>
  <button class="launcher" type="button" aria-label="打开劳博士" aria-expanded="false">劳</button>
`;

class PiAgentChat extends HTMLElement {
  static observedAttributes = ["open", "studio-url", "title", "width", "height", "accent"];

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).append(template.content.cloneNode(true));
    this.loaded = false;
  }

  connectedCallback() {
    this.shadowRoot.querySelector(".launcher").addEventListener("click", () => {
      this.toggleAttribute("open");
    });
    this.render();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.render();
  }

  render() {
    const open = this.hasAttribute("open");
    const title = this.getAttribute("title") || "劳博士";
    const launcher = this.shadowRoot.querySelector(".launcher");
    const panel = this.shadowRoot.querySelector(".panel");
    const iframe = this.shadowRoot.querySelector("iframe");

    launcher.setAttribute("aria-label", `${open ? "关闭" : "打开"}${title}`);
    launcher.setAttribute("aria-expanded", String(open));
    launcher.textContent = open ? "×" : "劳";
    panel.setAttribute("aria-label", title);
    iframe.title = title;

    const accent = this.getAttribute("accent");
    const width = this.getAttribute("width");
    const height = this.getAttribute("height");
    if (accent) this.style.setProperty("--pi-agent-accent", accent);
    if (width) this.style.setProperty("--pi-agent-width", width);
    if (height) this.style.setProperty("--pi-agent-height", height);

    if (open && !this.loaded) {
      iframe.src = this.getAttribute("studio-url") || "/chat";
      this.loaded = true;
      this.dispatchEvent(new CustomEvent("pi-agent-open"));
    } else if (!open && this.loaded) {
      this.dispatchEvent(new CustomEvent("pi-agent-close"));
    }
  }
}

if (!customElements.get("pi-agent-chat")) {
  customElements.define("pi-agent-chat", PiAgentChat);
}

(() => {
  'use strict';

  const host = window.location.hostname.toLowerCase();
  const isHomologation = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app') || host.endsWith('.onrender.com') || host.includes('homolog');
  if (!isHomologation) return;

  const PICKER_ID = 'acs-homolog-skin-picker';
  const STYLE_ID = 'acs-homolog-skin-picker-style';
  const STORAGE_KEY = 'acs.homolog.workspace-skin';
  const SKINS = [
    { id: 'black', label: 'Preto', color: '#000000', themeColor: '#000000' },
    { id: 'yellow', label: 'Amarelo', color: '#ffd84d', themeColor: '#151000' },
    { id: 'red', label: 'Vermelho', color: '#ff526b', themeColor: '#150407' },
    { id: 'blue', label: 'Azul', color: '#4d94ff', themeColor: '#030b18' },
    { id: 'green', label: 'Verde', color: '#42d99c', themeColor: '#03110c' },
    { id: 'white', label: 'Branco', color: '#ffffff', themeColor: '#f5f7fa' },
  ];

  const themeCss = `
    html[data-workspace-skin="black"]{--bg:#000;--surface:#080808;--surface2:#111;--panel:#080808;--panel2:#111;--line:#2b2b2b;--text:#f5f5f5;--muted:#a3a3a3;--cyan:#e4e4e7;--blue:#71717a;--green:#e4e4e7;--green2:#71717a;--skin-accent:#0b0b0b;--skin-accent-2:#262626;--skin-accent-contrast:#fff;--skin-button-border:#525252;--skin-glow:#ffffff12}
    html[data-workspace-skin="yellow"]{--bg:#151000;--surface:#211a03;--surface2:#2d2407;--panel:#211a03;--panel2:#2d2407;--line:#5f4e10;--text:#fff9d7;--muted:#d8c782;--cyan:#ffd84d;--blue:#ffb31a;--green:#ffd84d;--green2:#ffb31a;--skin-accent:#ffd84d;--skin-accent-2:#ffb31a;--skin-accent-contrast:#211700;--skin-button-border:#d5a900;--skin-glow:#ffd84d38}
    html[data-workspace-skin="red"]{--bg:#150407;--surface:#22080d;--surface2:#310d14;--panel:#22080d;--panel2:#310d14;--line:#66202d;--text:#fff0f3;--muted:#d8a2ad;--cyan:#ff5c73;--blue:#ff294b;--green:#ff526b;--green2:#d91f3e;--skin-accent:#ff526b;--skin-accent-2:#d91f3e;--skin-accent-contrast:#fff;--skin-button-border:#b9253d;--skin-glow:#ff526b34}
    html[data-workspace-skin="blue"]{--bg:#030b18;--surface:#081427;--surface2:#0d203b;--panel:#081427;--panel2:#0d203b;--line:#244b78;--text:#edf6ff;--muted:#9cb6d3;--cyan:#57a2ff;--blue:#2e70ff;--green:#4d94ff;--green2:#2f68e8;--skin-accent:#4d94ff;--skin-accent-2:#2f68e8;--skin-accent-contrast:#fff;--skin-button-border:#356fc2;--skin-glow:#4d94ff38}
    html[data-workspace-skin="green"]{--bg:#03110c;--surface:#071d15;--surface2:#0b2a1e;--panel:#071d15;--panel2:#0b2a1e;--line:#245f46;--text:#effff8;--muted:#9bc9b5;--cyan:#48dfa4;--blue:#19b878;--green:#42d99c;--green2:#1fb879;--skin-accent:#42d99c;--skin-accent-2:#1fb879;--skin-accent-contrast:#032017;--skin-button-border:#278a65;--skin-glow:#42d99c36}
    html[data-workspace-skin="white"]{--bg:#f5f7fa;--surface:#fff;--surface2:#eef1f5;--panel:#fff;--panel2:#eef1f5;--line:#cfd6df;--text:#111827;--muted:#667085;--cyan:#111827;--blue:#475467;--green:#111827;--green2:#475467;--skin-accent:#fff;--skin-accent-2:#e5e7eb;--skin-accent-contrast:#111827;--skin-button-border:#aeb8c5;--skin-glow:#0f172a14}
    html[data-workspace-skin]{background:var(--bg)}
    html[data-workspace-skin] body{background-color:var(--bg);color:var(--text);transition:background-color .24s ease,color .24s ease}
  `;

  function install() {
    if (document.getElementById(PICKER_ID)) return;
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `${themeCss}
        #${PICKER_ID}{position:fixed;top:18px;right:18px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:7px;border:1px solid var(--line,#2b2b2b);border-radius:16px;background:color-mix(in srgb,var(--surface,#080808) 94%,transparent);box-shadow:0 14px 38px #0005;backdrop-filter:blur(14px);transition:gap .18s ease,padding .18s ease,box-shadow .18s ease}
        #${PICKER_ID}.is-collapsed{gap:0;padding:4px;box-shadow:0 8px 22px #0004}
        #${PICKER_ID} .acs-homolog-skin-swatches{display:flex;align-items:center;gap:7px;max-width:260px;opacity:1;overflow:hidden;transition:max-width .2s ease,opacity .14s ease,gap .2s ease}
        #${PICKER_ID}.is-collapsed .acs-homolog-skin-swatches{max-width:0;gap:0;opacity:0;pointer-events:none}
        #${PICKER_ID} .acs-homolog-skin-swatch{--swatch:#000;width:31px;height:31px;padding:0;flex:0 0 31px;border:2px solid color-mix(in srgb,var(--swatch) 60%,#7b8796);border-radius:50%;background:var(--swatch);cursor:pointer;box-shadow:inset 0 0 0 2px #ffffff18,0 4px 10px #0004;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease}
        #${PICKER_ID} .acs-homolog-skin-swatch:hover,#${PICKER_ID} .acs-homolog-skin-swatch:focus-visible{transform:translateY(-2px) scale(1.06);outline:none}
        #${PICKER_ID} .acs-homolog-skin-swatch[aria-pressed="true"]{border-color:var(--text,#fff);box-shadow:0 0 0 3px var(--skin-glow,#ffffff12),inset 0 0 0 2px #ffffff24}
        #${PICKER_ID} .acs-homolog-skin-toggle{width:42px;height:42px;padding:0;flex:0 0 42px;display:grid;place-items:center;border:1px solid var(--skin-button-border,#525252);border-radius:13px;background:linear-gradient(135deg,var(--skin-accent,#0b0b0b),var(--skin-accent-2,#262626));color:var(--skin-accent-contrast,#fff);font:900 22px/1 Inter,ui-sans-serif,system-ui;cursor:pointer;box-shadow:0 8px 20px var(--skin-glow,#ffffff12)}
        @media(max-width:720px){#${PICKER_ID}{top:8px;right:8px;gap:5px;padding:5px;border-radius:14px}#${PICKER_ID}.is-collapsed{padding:3px}#${PICKER_ID} .acs-homolog-skin-swatches{gap:4px;max-width:220px}#${PICKER_ID} .acs-homolog-skin-swatch{width:25px;height:25px;flex-basis:25px}#${PICKER_ID} .acs-homolog-skin-toggle{width:36px;height:36px;flex-basis:36px;border-radius:11px;font-size:20px}}
        @media(max-width:430px){#${PICKER_ID}{max-width:calc(100vw - 16px)}#${PICKER_ID} .acs-homolog-skin-swatches{max-width:185px}#${PICKER_ID} .acs-homolog-skin-swatch{width:23px;height:23px;flex-basis:23px}}
      `;
      document.head.appendChild(style);
    }

    const picker = document.createElement('div');
    picker.id = PICKER_ID;
    picker.className = 'is-collapsed';
    picker.innerHTML = `<div class="acs-homolog-skin-swatches" role="group" aria-label="Escolha uma cor">${SKINS.map(skin => `<button type="button" class="acs-homolog-skin-swatch" data-skin="${skin.id}" aria-label="Skin ${skin.label}" aria-pressed="false" style="--swatch:${skin.color}"></button>`).join('')}</div><button type="button" class="acs-homolog-skin-toggle" aria-label="Mostrar seletor de cores" aria-expanded="false" title="Mostrar cores">‹</button>`;
    document.body.appendChild(picker);

    const swatches = picker.querySelector('.acs-homolog-skin-swatches');
    const toggle = picker.querySelector('.acs-homolog-skin-toggle');
    const buttons = [...picker.querySelectorAll('.acs-homolog-skin-swatch')];
    const setCollapsed = collapsed => {
      picker.classList.toggle('is-collapsed', collapsed);
      swatches.setAttribute('aria-hidden', String(collapsed));
      buttons.forEach(button => { button.tabIndex = collapsed ? -1 : 0; });
      toggle.textContent = collapsed ? '‹' : '›';
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Mostrar seletor de cores' : 'Esconder seletor de cores');
    };
    const applySkin = id => {
      const skin = SKINS.find(item => item.id === id) || SKINS[0];
      document.documentElement.dataset.workspaceSkin = skin.id;
      localStorage.setItem(STORAGE_KEY, skin.id);
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.skin === skin.id)));
      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
      meta.content = skin.themeColor;
    };

    const saved = localStorage.getItem(STORAGE_KEY);
    applySkin(SKINS.some(skin => skin.id === saved) ? saved : 'black');
    setCollapsed(true);
    toggle.addEventListener('click', event => { event.stopPropagation(); setCollapsed(!picker.classList.contains('is-collapsed')); });
    buttons.forEach(button => button.addEventListener('click', event => { event.stopPropagation(); applySkin(button.dataset.skin); }));
    document.addEventListener('click', event => { if (!picker.contains(event.target)) setCollapsed(true); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') setCollapsed(true); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

/** Design system IPHONE V2 : jetons de couleur, panneaux « verre anthracite », contours violets, accents dorés (fonctions divines). Injecté une fois. */
const CSS = `
:root{--gp-bg:rgba(20,22,32,.84);--gp-bg2:rgba(30,32,46,.9);--gp-line:rgba(160,120,255,.55);--gp-line-soft:rgba(160,120,255,.25);--gp-gold:#fccd5c;--gp-text:#e8ebf4;--gp-dim:#98a2b8;--gp-ok:#7ee0a0;--gp-bad:#ff8a8a;--gp-r:14px}
.gp{background:var(--gp-bg);border:1px solid var(--gp-line);border-radius:var(--gp-r);color:var(--gp-text);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 0 0 1px rgba(0,0,0,.4),0 6px 24px rgba(0,0,0,.45),0 0 14px rgba(150,100,255,.18)}
.gp-btn{background:var(--gp-bg2);border:1px solid var(--gp-line-soft);color:var(--gp-text);border-radius:12px;padding:8px 12px;min-height:40px;font:inherit;font-size:13px;transition:transform .08s,background .12s,border-color .12s}
.gp-btn:active{transform:scale(.96);background:rgba(120,80,220,.35);border-color:var(--gp-line)}
.gp-btn.gold{border-color:rgba(252,205,92,.65);color:var(--gp-gold)} .gp-btn.gold:active{background:rgba(252,205,92,.22)}
.gp-btn[disabled]{opacity:.4}
.gp-tabs{display:flex;gap:4px;border-bottom:1px solid var(--gp-line-soft);padding:0 8px}
.gp-tabs button{flex:1;background:none;border:0;border-bottom:2px solid transparent;color:var(--gp-dim);padding:10px 4px;font:inherit;font-size:12px;letter-spacing:.06em;text-transform:uppercase;min-height:42px}
.gp-tabs button.on{color:var(--gp-gold);border-bottom-color:var(--gp-gold)}
.gp-bar{height:7px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden} .gp-bar i{display:block;height:100%;border-radius:4px}
.gp-sec{font-size:10px;letter-spacing:.1em;color:var(--gp-gold);margin:12px 0 4px;text-transform:uppercase}
`;
let done = false;
export function installTheme() { if (done) return; done = true; const s = document.createElement('style'); s.id = 'gp-theme'; s.textContent = CSS; document.head.appendChild(s); }

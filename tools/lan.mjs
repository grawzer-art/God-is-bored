#!/usr/bin/env node
// Lance le serveur de développement accessible depuis l'iPhone (même Wi-Fi) et affiche l'adresse exacte + un QR code.
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const port = Number(process.env.PORT || 5173);

function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const n of list ?? []) {
      if (n.family !== 'IPv4' || n.internal) continue;
      const priv = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address);
      const wifi = /^(en0|en1|wlan|wl|wi)/i.test(name);
      out.push({ name, ip: n.address, score: (priv ? 2 : 0) + (wifi ? 1 : 0) });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

const addrs = lanAddresses();
console.log('\n=== GOD IS BORED — accès depuis l\'iPhone ===');
if (!addrs.length) {
  console.log('Aucune adresse réseau détectée. Vérifiez que le Mac est connecté au Wi-Fi.');
} else {
  const best = addrs[0]; const url = `http://${best.ip}:${port}/`;
  console.log(`\nSur l'iPhone (même Wi-Fi), ouvrez dans Safari :\n\n    ${url}\n`);
  if (addrs.length > 1) console.log('Autres adresses possibles : ' + addrs.slice(1).map((a) => `http://${a.ip}:${port}/ (${a.name})`).join(', ') + '\n');
  const host = os.hostname().replace(/\.local$/i, '').replace(/[^a-zA-Z0-9-]/g, '-');
  if (host) console.log(`Variante (nom Bonjour du Mac) : http://${host}.local:${port}/\n`);
  try { require('qrcode-terminal').generate(url, { small: true }); } catch { /* QR facultatif */ }
  console.log('\nSi la page ne s\'ouvre pas : même réseau Wi-Fi ? pare-feu macOS (autoriser « node ») ? réseau invité / isolation des appareils ?\n');
}
const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
const child = spawn(process.execPath, [vite, '--host', '0.0.0.0', '--port', String(port), '--strictPort'], { stdio: 'inherit' });
child.on('exit', (c) => process.exit(c ?? 0));
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { child.kill(sig); setTimeout(() => process.exit(0), 300); });
process.on('exit', () => child.kill());

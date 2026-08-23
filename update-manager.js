import { UPDATE_CONFIG } from './update-config.js';

const VERSION_KEY = 'mycollab.web.active-version';
const LATER_KEY = 'mycollab.web.update-later';
const CHECKED_KEY = 'mycollab.web.update-checked-at';
const UPDATE_STYLE_ID = 'mycollab-update-style';

const log = (...args) => console.log('[Updater]', ...args);
const warn = (...args) => console.warn('[Updater]', ...args);

function parseVersion(value) {
  const match = String(value || '').trim().match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ? match[4].split('.') : [] };
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  }
  if (!a.prerelease.length && !b.prerelease.length) return 0;
  if (!a.prerelease.length) return 1;
  if (!b.prerelease.length) return -1;
  for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index += 1) {
    const first = a.prerelease[index];
    const second = b.prerelease[index];
    if (first === undefined) return -1;
    if (second === undefined) return 1;
    if (first === second) continue;
    const firstNumber = /^\d+$/.test(first);
    const secondNumber = /^\d+$/.test(second);
    if (firstNumber && secondNumber) return Number(first) > Number(second) ? 1 : -1;
    if (firstNumber !== secondNumber) return firstNumber ? -1 : 1;
    return first > second ? 1 : -1;
  }
  return 0;
}

function configuredServer() {
  try {
    const server = new URL(UPDATE_CONFIG.UPDATE_SERVER);
    if (server.protocol !== 'https:' || server.hostname === 'YOUR_USERNAME.github.io') return null;
    if (!server.pathname.endsWith('/')) server.pathname += '/';
    return server;
  } catch {
    return null;
  }
}

function isSafeReleaseUrl(releaseUrl, server) {
  try {
    const release = new URL(releaseUrl, server);
    return release.origin === server.origin && release.pathname.startsWith(server.pathname) && release.pathname.endsWith('/');
  } catch {
    return false;
  }
}

function safePath(path) {
  return typeof path === 'string' && path.length > 0 && path.length < 512 && !path.startsWith('/') && !path.includes('..') && !/[?#]/.test(path);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPDATE_CONFIG.UPDATE_TIMEOUT_MS);
  try {
    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function addStyles() {
  if (document.getElementById(UPDATE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = UPDATE_STYLE_ID;
  style.textContent = `
    .mycollab-update-backdrop{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:1rem;background:rgba(7,13,25,.78);backdrop-filter:blur(8px)}
    .mycollab-update-card{width:min(440px,100%);padding:1.5rem;border:1px solid rgba(125,211,252,.28);border-radius:14px;background:#101b2d;color:#f8fafc;box-shadow:0 24px 70px rgba(0,0,0,.4);font-family:inherit}
    .mycollab-update-card h2{margin:0 0 .65rem;font-size:1.35rem}.mycollab-update-card p{color:#cbd5e1;line-height:1.5}.mycollab-update-meta{display:grid;gap:.4rem;margin:1rem 0;color:#cbd5e1;font-size:.92rem}.mycollab-update-meta strong{color:#fff}.mycollab-update-actions{display:flex;gap:.65rem;margin-top:1.2rem}.mycollab-update-actions button{flex:1;padding:.7rem 1rem;border:0;border-radius:8px;font-weight:700;cursor:pointer}.mycollab-update-primary{background:#38bdf8;color:#082f49}.mycollab-update-secondary{background:#24344e;color:#dbeafe}.mycollab-update-progress{height:8px;margin:1rem 0 .5rem;border-radius:99px;background:#263852;overflow:hidden}.mycollab-update-progress i{display:block;width:0;height:100%;background:#38bdf8;transition:width .15s ease}.mycollab-update-status{font-size:.9rem;color:#bae6fd}
  `;
  document.head.appendChild(style);
}

function showDialog(remote, current, onUpdate) {
  addStyles();
  const backdrop = document.createElement('div');
  backdrop.className = 'mycollab-update-backdrop';
  const notes = Array.isArray(remote.releaseNotes) ? remote.releaseNotes : [];
  const laterButton = remote.required ? '' : '<button class="mycollab-update-secondary" data-later>Later</button>';
  backdrop.innerHTML = `<section class="mycollab-update-card" role="dialog" aria-modal="true" aria-labelledby="mycollab-update-title"><h2 id="mycollab-update-title">Update available</h2><p>${remote.required ? 'A required update is ready.' : 'A new version of My Collab is ready.'}</p><div class="mycollab-update-meta"><span>Current version: <strong>${current}</strong></span><span>New version: <strong>${remote.version}</strong></span>${notes.length ? `<span>What's new: ${notes.map(note => `<br>• ${String(note).replace(/[<>]/g, '')}`).join('')}</span>` : ''}</div><div class="mycollab-update-actions">${laterButton}<button class="mycollab-update-primary" data-update>Update now</button></div></section>`;
  document.body.appendChild(backdrop);
  backdrop.querySelector('[data-later]')?.addEventListener('click', () => { localStorage.setItem(LATER_KEY, remote.version); backdrop.remove(); });
  backdrop.querySelector('[data-update]').addEventListener('click', () => onUpdate(backdrop));
}

function showProgress(backdrop, label, percent) {
  const card = backdrop.querySelector('.mycollab-update-card');
  card.innerHTML = `<h2>Updating My Collab</h2><p class="mycollab-update-status">${label}</p><div class="mycollab-update-progress"><i style="width:${percent}%"></i></div><p class="mycollab-update-status">${percent}%</p>`;
}

function showUpdateNotice(message) {
  addStyles();
  const notice = document.createElement('div');
  notice.className = 'mycollab-update-offline';
  notice.textContent = message;
  notice.style.cssText = 'position:fixed;right:1rem;bottom:1rem;z-index:100000;max-width:calc(100% - 2rem);padding:.75rem 1rem;border:1px solid rgba(148,163,184,.35);border-radius:8px;background:#18263b;color:#e2e8f0;box-shadow:0 12px 30px rgba(0,0,0,.25);font:500 .9rem/1.4 inherit';
  document.body.appendChild(notice);
  setTimeout(() => notice.remove(), 4500);
}

async function downloadRelease(remote, server, backdrop) {
  showProgress(backdrop, 'Preparing download...', 0);
  const release = new URL(remote.releaseUrl, server);
  const manifestUrl = new URL('manifest.json', release);
  const manifest = await fetchJson(manifestUrl.href);
  if (manifest.version !== remote.version || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Invalid release manifest');
  const files = manifest.files.filter(file => file && safePath(file.path) && typeof file.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(file.sha256));
  if (files.length !== manifest.files.length) throw new Error('Manifest contains an unsafe or incomplete file');
  if (!files.some(file => file.path === 'index.html') || !files.some(file => file.path === 'update-manager.js')) throw new Error('Release is missing required app files');

  const cacheName = `mycollab-release-${remote.version}`;
  const cache = await caches.open(cacheName);
  let completed = 0;
  for (const file of files) {
    const response = await fetch(new URL(file.path, release), { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to download ${file.path}`);
    const bytes = await response.arrayBuffer();
    if (file.size !== undefined && Number(file.size) !== bytes.byteLength) throw new Error(`Size mismatch for ${file.path}`);
    if ((await sha256(bytes)).toLowerCase() !== file.sha256.toLowerCase()) throw new Error(`Integrity check failed for ${file.path}`);
    const localUrl = new URL(file.path, window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1));
    await cache.put(localUrl.href, new Response(bytes, { headers: response.headers }));
    completed += 1;
    showProgress(backdrop, 'Downloading and verifying files...', Math.round(completed / files.length * 100));
  }
  showProgress(backdrop, 'Installing update...', 100);
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: 'ACTIVATE_RELEASE', version: remote.version, cacheName });
  await new Promise(resolve => setTimeout(resolve, 350));
  localStorage.setItem(VERSION_KEY, remote.version);
  localStorage.removeItem(LATER_KEY);
  showProgress(backdrop, 'Update complete. Restarting...', 100);
  setTimeout(() => window.location.reload(), 500);
}

async function checkForUpdate(force = false) {
  if (!UPDATE_CONFIG.UPDATE_ENABLED || UPDATE_CONFIG.DEVELOPMENT_MODE || !window.Capacitor?.isNativePlatform?.()) return;
  const server = configuredServer();
  if (!server) { warn('Update server is not configured.'); return; }
  const lastChecked = Number(localStorage.getItem(CHECKED_KEY) || 0);
  if (!force && Date.now() - lastChecked < UPDATE_CONFIG.UPDATE_CHECK_INTERVAL_MS) return;
  localStorage.setItem(CHECKED_KEY, String(Date.now()));
  const current = localStorage.getItem(VERSION_KEY) || UPDATE_CONFIG.BUNDLED_VERSION;
  log('Checking for updates...', current);
  try {
    const remote = await fetchJson(new URL('version.json', server).href);
    if (!parseVersion(remote.version) || !isSafeReleaseUrl(remote.releaseUrl, server)) throw new Error('Invalid remote version metadata');
    log('Remote version:', remote.version);
    if (compareVersions(remote.version, current) <= 0) return;
    if (localStorage.getItem(LATER_KEY) === remote.version && !remote.required) return;
    showDialog(remote, current, async backdrop => {
      try { await downloadRelease(remote, server, backdrop); }
      catch (error) {
        warn('Update failed:', error);
        if (remote.required && navigator.onLine) {
          backdrop.querySelector('.mycollab-update-card').innerHTML = '<h2>Update could not be installed</h2><p>Please try again while connected to the internet.</p><div class="mycollab-update-actions"><button class="mycollab-update-primary" data-retry>Retry update</button></div>';
          backdrop.querySelector('[data-retry]').addEventListener('click', () => { localStorage.removeItem(CHECKED_KEY); backdrop.remove(); checkForUpdate(); });
        } else {
          backdrop.remove();
        }
      }
    });
  } catch (error) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    warn(offline ? 'Internet unavailable; continuing with local version.' : 'Update check failed; continuing with local version.', error.message);
    if (offline) showUpdateNotice('Internet unavailable. Using locally installed version.');
  }
}

async function registerUpdater() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' });
    const registration = await navigator.serviceWorker.ready;
    const activeVersion = localStorage.getItem(VERSION_KEY);
    if (activeVersion) registration.active?.postMessage({ type: 'MARK_HEALTHY', version: activeVersion });
    checkForUpdate(true);
  } catch (error) {
    warn('Service worker unavailable; continuing with bundled app.', error);
  }
}

window.addEventListener('online', () => checkForUpdate());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });
registerUpdater();

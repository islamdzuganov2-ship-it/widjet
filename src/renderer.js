'use strict';
const api = window.geoWidget;
const $ = (id) => document.getElementById(id);

let currentTz = 'UTC';
let clockTimer = null;

// ---------- Страна / таймзона ----------
function startClock(tz) {
  currentTz = tz || 'UTC';
  if (clockTimer) clearInterval(clockTimer);
  const fmt = new Intl.DateTimeFormat('ru-RU', {
    timeZone: currentTz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const tick = () => { try { $('geoClock').textContent = fmt.format(new Date()); } catch { $('geoClock').textContent = '—'; } };
  tick();
  clockTimer = setInterval(tick, 1000);
}

function renderGeo(info, sourceLabel) {
  if (info.timeZone) { $('geoTz').textContent = info.timeZone; startClock(info.timeZone); }
  if (info.country) {
    $('geoFlag').textContent = info.country.flag || '🌐';
    $('geoCountry').textContent = info.country.name || info.country.code || '—';
  } else {
    $('geoCountry').textContent = 'Не определено';
  }
  if (sourceLabel) $('geoSource').textContent = sourceLabel;
}

async function loadLocalGeo() {
  const r = await api.localGeo();
  if (r.ok) renderGeo(r, 'по системной таймзоне');
}

async function loadIpGeo() {
  $('ipBtn').textContent = 'Проверяю…';
  const r = await api.ipGeo();
  $('ipBtn').textContent = 'Уточнить по IP';
  if (r.ok) renderGeo(r, 'по IP-адресу');
  else toast('Не удалось определить по IP');
}

// ---------- Аудит разрешений ----------
function prettyName(item) {
  if (item.type === 'global') return 'Системный доступ к расположению';
  if (item.type === 'win32') return item.display || 'Приложение';
  // packaged: "Microsoft.BingWeather_8wekyb3d8bbwe" -> "BingWeather"
  let s = String(item.display || '');
  s = s.split('_')[0];
  const dot = s.lastIndexOf('.');
  return dot >= 0 ? s.slice(dot + 1) : s;
}

function metaLine(item) {
  const parts = [];
  if (item.inUse) parts.push('● сейчас использует');
  else if (item.lastStart) {
    try { parts.push('был доступ: ' + new Date(item.lastStart).toLocaleString('ru-RU')); }
    catch { /* ignore */ }
  }
  if (item.type === 'win32' && item.path) parts.push(item.path);
  else if (item.type === 'packaged') parts.push('приложение Microsoft Store');
  return parts.join('  ·  ');
}

function statusClass(value, inUse) {
  if (inUse) return 'live';
  if (value === 'Allow') return 'allow';
  if (value === 'Deny') return 'deny';
  return 'prompt';
}

function rank(item) {
  if (item.inUse) return 0;
  if (item.lastStart) return 1;
  if (item.type === 'global') return 2;
  return 3;
}

function renderAudit(items) {
  const list = $('auditList');
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<div class="empty">Приложения, запрашивавшие геолокацию, не найдены.</div>';
    return;
  }
  items.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.lastStart && b.lastStart) return new Date(b.lastStart) - new Date(a.lastStart);
    return prettyName(a).localeCompare(prettyName(b), 'ru');
  });

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'app-row';

    const dot = document.createElement('i');
    dot.className = 'dot status-dot ' + statusClass(item.value, item.inUse);

    const info = document.createElement('div');
    info.className = 'app-info';
    const name = document.createElement('div');
    name.className = 'app-name';
    name.textContent = prettyName(item);
    const meta = document.createElement('div');
    meta.className = 'app-meta';
    meta.textContent = metaLine(item) || 'ещё не обращалось';
    info.append(name, meta);

    row.append(dot, info);

    if (item.canToggle) {
      const tg = document.createElement('div');
      tg.className = 'toggle';
      const allow = document.createElement('button');
      allow.textContent = 'Разр.';
      const deny = document.createElement('button');
      deny.textContent = 'Запр.';
      if (item.value === 'Allow') allow.classList.add('on-allow');
      if (item.value === 'Deny') deny.classList.add('on-deny');
      allow.onclick = () => setPerm(item, 'Allow', dot, allow, deny);
      deny.onclick = () => setPerm(item, 'Deny', dot, allow, deny);
      tg.append(allow, deny);
      row.append(tg);
    } else {
      const b = document.createElement('span');
      b.className = 'badge-sys';
      b.textContent = item.value === 'Allow' ? 'разрешено' : item.value === 'Deny' ? 'запрещено' : 'системно';
      row.append(b);
    }
    list.append(row);
  }
}

async function setPerm(item, value, dot, allowBtn, denyBtn) {
  const r = await api.setPermission(item.regPath, value);
  if (r && r.ok) {
    item.value = value;
    allowBtn.classList.toggle('on-allow', value === 'Allow');
    denyBtn.classList.toggle('on-deny', value === 'Deny');
    dot.className = 'dot status-dot ' + statusClass(value, item.inUse);
    toast(value === 'Allow' ? 'Доступ разрешён (настройка Windows)' : 'Доступ запрещён (настройка Windows)');
  } else {
    toast('Ошибка: ' + ((r && r.error) || 'не удалось изменить'));
  }
}

async function loadAudit() {
  $('auditEmpty') && ($('auditList').innerHTML = '<div class="empty">Чтение журнала Windows…</div>');
  const r = await api.listAudit();
  if (r.ok) renderAudit(r.items || []);
  else $('auditList').innerHTML = '<div class="empty">Не удалось прочитать журнал:<br>' + (r.error || '') + '</div>';
}

// ---------- Утилиты UI ----------
let toastTimer = null;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- Регулятор прозрачности фона ----------
const OPACITY_KEY = 'glassOpacity';
function applyOpacity(pct) {
  pct = Math.max(25, Math.min(100, Math.round(pct)));
  document.documentElement.style.setProperty('--panel-alpha', (pct / 100).toFixed(2));
  const vEl = $('opacityVal'); if (vEl) vEl.textContent = pct + '%';
  const r = $('opacityRange'); if (r && Number(r.value) !== pct) r.value = pct;
  return pct;
}
function saveOpacity(pct) { try { localStorage.setItem(OPACITY_KEY, String(pct)); } catch { /* ignore */ } }
(function initOpacity() {
  let saved = 72;
  try { const s = parseInt(localStorage.getItem(OPACITY_KEY), 10); if (Number.isFinite(s)) saved = s; } catch { /* ignore */ }
  applyOpacity(saved);

  const btn = $('opacityBtn'), pop = $('opacityPop'), range = $('opacityRange');
  if (btn && pop) btn.onclick = (e) => { e.stopPropagation(); pop.classList.toggle('open'); };
  if (range) range.oninput = () => saveOpacity(applyOpacity(Number(range.value)));
  document.querySelectorAll('.preset').forEach((p) => {
    p.onclick = () => saveOpacity(applyOpacity(Number(p.dataset.v)));
  });
  document.addEventListener('click', (e) => {
    if (pop && !pop.contains(e.target) && e.target !== btn) pop.classList.remove('open');
  });
})();

// ---------- События ----------
$('closeBtn').onclick = () => api.close();
$('minBtn').onclick = () => api.minimize();
$('pinBtn').onclick = async () => {
  const pinned = await api.togglePin();
  $('pinBtn').classList.toggle('pinned', pinned);
};
$('refreshBtn').onclick = loadAudit;
$('ipBtn').onclick = loadIpGeo;
$('settingsBtn').onclick = () => api.openLocationSettings();

// ---------- Старт ----------
$('pinBtn').classList.add('pinned');
loadLocalGeo();
loadAudit();
setInterval(loadAudit, 15000); // автообновление аудита

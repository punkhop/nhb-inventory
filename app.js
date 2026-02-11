const DATA = JSON.parse(document.getElementById('inventory-data').textContent);

const AREA_COLORS = {
  Camp: '#e8c547', Kitchen: '#e05555', Club: '#4caf50',
  Medical: '#888', Bar: '#4a9eff', General: '#6a9fd8'
};
const AREAS = ['All', 'Camp', 'Kitchen', 'Club', 'Medical', 'Bar', 'General', 'No Area'];

let currentArea = 'All';
let currentTab = 'items';
let currentPriority = null;
let searchQuery = '';
let expandedBins = new Set();

// Build area chips
const chipsEl = document.getElementById('areaChips');
AREAS.forEach(a => {
  const btn = document.createElement('button');
  btn.className = 'chip' + (a === 'All' ? ' active' : '');
  btn.dataset.area = a;
  btn.textContent = a;
  btn.onclick = () => setArea(a);
  chipsEl.appendChild(btn);
});

// Search
const searchEl = document.querySelector('.search');
const clearBtn = document.querySelector('.clear-btn');
searchEl.addEventListener('input', () => {
  searchQuery = searchEl.value.trim().toLowerCase();
  clearBtn.classList.toggle('show', searchQuery.length > 0);
  render();
});

function clearSearch() {
  searchEl.value = '';
  searchQuery = '';
  clearBtn.classList.remove('show');
  render();
  searchEl.focus();
}

function setArea(a) {
  currentArea = a;
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.area === a));
  render();
}

function setTab(t) {
  currentTab = t;
  document.querySelectorAll('.tab').forEach(tb => tb.classList.toggle('active', tb.dataset.tab === t));
  render();
}

function togglePriority(p) {
  currentPriority = currentPriority === p ? null : p;
  document.querySelectorAll('.priority-chip').forEach(c => {
    const cp = c.dataset.p;
    c.classList.remove('active-arrival', 'active-strike');
    if (currentPriority === cp) {
      c.classList.add(cp === 'Arrival' ? 'active-arrival' : 'active-strike');
    }
  });
  render();
}

function getAreaForLoc(loc) {
  if (!loc) return '';
  if (loc.startsWith('Y') || loc.startsWith('CAMP')) return 'Camp';
  if (loc.startsWith('R') || loc.startsWith('KIT')) return 'Kitchen';
  if (loc.startsWith('G') || loc.startsWith('CLUB')) return 'Club';
  if (loc.startsWith('X') || loc.startsWith('MED')) return 'Medical';
  if (/^B\d/.test(loc) || loc.startsWith('BAR')) return 'Bar';
  if (loc.startsWith('Kitchen')) return 'Kitchen';
  if (loc.startsWith('Club')) return 'Club';
  return '';
}

function dotColor(loc) {
  return AREA_COLORS[getAreaForLoc(loc)] || '#555';
}

function matchesFilter(item) {
  if (currentArea !== 'All') {
    if (currentArea === 'No Area') {
      if (item.a) return false;
    } else {
      const itemArea = item.a || getAreaForLoc(item.l) || '';
      if (!itemArea.includes(currentArea)) return false;
    }
  }
  if (currentPriority) {
    if (!item.p || !item.p.includes(currentPriority)) return false;
  }
  if (searchQuery) {
    const hay = (item.n + '|' + (item.a || '') + '|' + (item.l || '') + '|' + (item.t || '') + '|' + (item.s || '')).toLowerCase();
    return hay.includes(searchQuery);
  }
  return true;
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function highlightMatch(text) {
  if (!searchQuery || !text) return esc(text || '');
  const lower = text.toLowerCase();
  const idx = lower.indexOf(searchQuery);
  if (idx === -1) return esc(text);
  return esc(text.slice(0, idx)) + '<mark>' + esc(text.slice(idx, idx + searchQuery.length)) + '</mark>' + esc(text.slice(idx + searchQuery.length));
}

function render() {
  const filtered = DATA.filter(matchesFilter);
  document.getElementById('stats').textContent = filtered.length + ' of ' + DATA.length + ' items';

  if (currentTab === 'bins') { renderBins(filtered); return; }

  const groups = {};
  filtered.forEach(item => {
    const locs = item.l ? item.l.split(', ').filter(Boolean) : ['No Location'];
    locs.forEach(loc => {
      if (!groups[loc]) groups[loc] = [];
      groups[loc].push(item);
    });
  });

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'No Location') return 1;
    if (b === 'No Location') return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  const content = document.getElementById('content');
  if (filtered.length === 0) {
    content.innerHTML = '<div class="empty"><div class="empty-icon">&#x1F4E6;</div><div class="empty-text">No items found</div></div>';
    return;
  }

  let html = '';
  sortedKeys.forEach(loc => {
    const items = groups[loc];
    const isExpanded = expandedBins.has(loc) || searchQuery.length > 0;
    const dc = dotColor(loc);

    html += '<div class="bin-group">';
    html += '<div class="bin-header" data-loc="' + esc(loc) + '">';
    html += '<div class="bin-name"><span class="bin-dot" style="background:' + dc + '"></span>' + highlightMatch(loc) + '</div>';
    html += '<div class="bin-count">' + items.length + '</div></div>';
    html += '<div class="bin-items' + (isExpanded ? '' : ' collapsed') + '" data-loc-items="' + esc(loc) + '">';

    items.forEach(item => {
      html += '<div class="item"><div class="item-left"><div class="item-name">' + highlightMatch(item.n) + '</div>';
      const meta = [];
      if (item.a) meta.push(item.a);
      if (item.s) meta.push(item.s);
      if (meta.length) html += '<div class="item-meta">' + esc(meta.join(' \u00b7 ')) + '</div>';
      if (item.t) html += '<div class="item-note">' + highlightMatch(item.t) + '</div>';
      html += '</div><div class="item-right">';
      if (item.q != null) html += '<div class="item-qty">' + item.q + '</div>';
      if (item.p && item.p.length) {
        item.p.forEach(p => {
          html += '<div class="badge badge-' + p.toLowerCase() + '">' + esc(p) + '</div>';
        });
      }
      html += '</div></div>';
    });
    html += '</div></div>';
  });
  content.innerHTML = html;
}

function renderBins(filtered) {
  const binCounts = {};
  const binAreas = {};
  filtered.forEach(item => {
    const locs = (item.l || '').split(', ').filter(Boolean);
    locs.forEach(loc => {
      binCounts[loc] = (binCounts[loc] || 0) + 1;
      if (item.a && !binAreas[loc]) binAreas[loc] = item.a;
    });
  });

  const sorted = Object.entries(binCounts).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  const content = document.getElementById('content');

  if (sorted.length === 0) {
    content.innerHTML = '<div class="empty"><div class="empty-icon">&#x1F4E6;</div><div class="empty-text">No bins found</div></div>';
    return;
  }

  let html = '<div class="bins-grid">';
  sorted.forEach(([loc, count]) => {
    const dc = dotColor(loc);
    const area = binAreas[loc] || getAreaForLoc(loc) || '';
    html += '<div class="bin-card" data-bin="' + esc(loc) + '">';
    html += '<div class="bin-card-name"><span class="bin-dot" style="background:' + dc + '"></span>' + esc(loc) + '</div>';
    html += '<div class="bin-card-count">' + count + ' item' + (count !== 1 ? 's' : '') + '</div>';
    if (area) html += '<div class="bin-card-area">' + esc(area) + '</div>';
    html += '</div>';
  });
  html += '</div>';
  content.innerHTML = html;
}

// Event delegation for clicks
document.getElementById('content').addEventListener('click', e => {
  const header = e.target.closest('.bin-header');
  if (header) {
    const loc = header.dataset.loc;
    const items = header.nextElementSibling;
    if (expandedBins.has(loc)) {
      expandedBins.delete(loc);
      items.classList.add('collapsed');
    } else {
      expandedBins.add(loc);
      items.classList.remove('collapsed');
    }
    return;
  }
  const card = e.target.closest('.bin-card');
  if (card) {
    const loc = card.dataset.bin;
    setTab('items');
    searchEl.value = loc;
    searchQuery = loc.toLowerCase();
    clearBtn.classList.add('show');
    expandedBins.add(loc);
    render();
  }
});

// Make header functions global for onclick handlers
window.clearSearch = clearSearch;
window.setTab = setTab;
window.togglePriority = togglePriority;

// Theme toggle
const themeBtn = document.querySelector('.theme-toggle');
function applyTheme(light) {
  document.body.classList.toggle('light', light);
  themeBtn.textContent = light ? '\u2600\uFE0F' : '\uD83C\uDF19';
  document.querySelector('meta[name="theme-color"]').content = light ? '#f5f5f0' : '#1a1a1a';
}
function toggleTheme() {
  const isLight = !document.body.classList.contains('light');
  localStorage.setItem('nhb-theme', isLight ? 'light' : 'dark');
  applyTheme(isLight);
}
applyTheme(localStorage.getItem('nhb-theme') === 'light');
window.toggleTheme = toggleTheme;

// Updated timestamp
document.querySelector('.updated').textContent = 'Updated: ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Service worker — auto-updates on open or switch-back
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
  // Recheck for updates when user switches back to the app
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) reg.update();
      });
    }
  });
}

render();

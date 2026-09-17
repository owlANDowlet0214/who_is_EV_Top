/* EV メーカー別普及インフォグラフィック — 表示ロジック
   データは data/ev-sales.json が唯一の情報源。index.html の数値は読込前の初期表示。 */
(function () {
  'use strict';
  var DATA_URL = 'data/ev-sales.json';

  // フォールバック（JSON が読めなかった場合に使う）
  var YEARS = {
    2021: { byd: 32.1, tesla: 93.6, geely: 10.0, vw: 45.3, saic: 59.6, changan: 7.5, hk: 19.0, bmw: 10.3 },
    2022: { byd: 91.1, tesla: 131.4, geely: 25.0, vw: 57.2, saic: 74.5, changan: 17.0, hk: 30.0, bmw: 21.6 },
    2023: { byd: 157.4, tesla: 180.9, geely: 48.0, vw: 77.1, saic: 83.0, changan: 29.0, hk: 38.0, bmw: 37.6 },
    2024: { byd: 176.4, tesla: 178.9, geely: 78.0, vw: 74.4, saic: 83.0, changan: 44.0, hk: 42.0, bmw: 42.6 },
    2025: { byd: 226.0, tesla: 164.0, geely: 125.0, vw: 101.0, saic: 90.0, changan: 62.0, hk: 60.0, bmw: 43.0 }
  };
  var ORIGIN = { byd: '中国', tesla: '米国', geely: '中国', vw: 'ドイツ', saic: '中国', changan: '中国', hk: '韓国', bmw: 'ドイツ' };
  var SHARE = [
    { name: 'BYD', color: '#3ddc97', pct: 12 }, { name: 'テスラ', color: '#e8503a', pct: 9 },
    { name: '吉利', color: '#5aa9ff', pct: 7 }, { name: 'VWグループ', color: '#a78bfa', pct: 5 },
    { name: '上汽', color: '#ffcf5c', pct: 5 }, { name: '長安', color: '#ff9ecb', pct: 3 },
    { name: '現代・起亜', color: '#58e0e8', pct: 3 }, { name: 'BMWグループ', color: '#b9c4d4', pct: 2 },
    { name: 'その他', color: '#232c39', pct: 54 }
  ];

  var root = document.getElementById('ev-root');
  var yearBar = document.getElementById('ev-years');
  var barWrap = document.getElementById('ev-bars');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var year = null, io = null;

  /* ---------- スクロール連動アニメーション ---------- */
  function setup() {
    var nodes = [].slice.call(root.querySelectorAll('[data-anim], [data-count]'));
    if (!nodes.length) return;
    var idx = {};
    function play(el) {
      if (el.dataset.played) return;
      el.dataset.played = '1';
      var kind = el.dataset.anim || 'count';
      var i = idx[kind] || 0; idx[kind] = i + 1;
      var d = reduce ? 0 : Math.min(i * 0.045, 0.9);
      if (el.hasAttribute('data-count')) return count(el);
      if (reduce) { el.style.opacity = 1; el.style.transform = 'none'; el.style.strokeDashoffset = 0; return; }
      if (kind === 'up') el.style.animation = 'evFadeUp .85s cubic-bezier(.22,1,.36,1) ' + d + 's both';
      else if (kind === 'fade') el.style.animation = 'evFade .9s ease .9s both';
      else if (kind === 'pop') el.style.animation = 'evPop .55s cubic-bezier(.34,1.56,.64,1) ' + (d + 0.1) + 's both';
      else if (kind === 'barx') el.style.animation = 'evGrowX 1.05s cubic-bezier(.22,1,.36,1) ' + d + 's both';
      else if (kind === 'bary') el.style.animation = 'evGrowY .95s cubic-bezier(.22,1,.36,1) ' + d + 's both';
      else if (kind === 'draw') el.style.animation = 'evDraw 1.7s ease-out ' + d + 's both';
    }
    if (io) io.disconnect();
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { play(en.target); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    nodes.forEach(function (n) { io.observe(n); });
    setTimeout(function () { // 万一 IO が動かなくても内容は見える
      if (!nodes.some(function (n) { return n.dataset.played; })) nodes.forEach(play);
    }, 1600);
  }

  function count(el) {
    var target = parseFloat(el.dataset.count);
    var dec = parseInt(el.dataset.decimals || '0', 10);
    if (reduce) { el.textContent = target.toFixed(dec); return; }
    tween(el, 0, target, dec, 1500);
  }

  function tween(el, from, to, dec, dur) {
    var t0 = performance.now();
    function step(t) {
      var p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (from + (to - from) * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- ランキング（年切替） ---------- */
  function renderWaffle() {
    var wrap = document.getElementById('ev-waffle');
    if (!wrap) return;
    wrap.innerHTML = '';
    SHARE.forEach(function (s) {
      for (var i = 0; i < s.pct; i++) {
        var c = document.createElement('div');
        c.dataset.anim = 'pop';
        c.title = s.name + ' ' + s.pct + '%';
        c.style.cssText = 'opacity:0;aspect-ratio:1;border-radius:2px;background:' + s.color;
        wrap.appendChild(c);
      }
    });
  }

  function setYear(y) {
    if (y === year) return;
    var data = YEARS[y];
    if (!data) return;
    year = y;
    [].forEach.call(yearBar.children, function (b) {
      var on = parseInt(b.dataset.year, 10) === y;
      b.style.background = on ? '#c6f24e' : 'transparent';
      b.style.color = on ? '#07090d' : '#8b97a8';
      b.style.fontWeight = on ? 700 : 500;
    });
    var order = Object.keys(data).sort(function (a, b) { return data[b] - data[a]; });
    var max = data[order[0]];
    var rows = [].slice.call(barWrap.children);
    var h = rows[0] ? rows[0].getBoundingClientRect().height + 10 : 0;
    rows.forEach(function (row, from) {
      var k = row.dataset.bar, to = order.indexOf(k);
      row.style.transform = 'translateY(' + ((to - from) * h) + 'px)';
      row.style.zIndex = String(50 - to);
      var fill = row.querySelector('[data-fill]');
      if (fill) {
        if (fill.dataset.played) { fill.style.animation = 'none'; fill.style.transform = 'scaleX(1)'; }
        fill.style.width = (data[k] / max * 100).toFixed(1) + '%';
      }
      var val = row.querySelector('[data-val]');
      if (val) tween(val, parseFloat((val.textContent || '').replace(/,/g, '')) || 0, data[k], 0, 700);
      var rank = row.querySelector('[data-rank]');
      if (rank) rank.textContent = (ORIGIN[k] || '') + ' · ' + (to + 1) + '位';
    });
  }

  /* ---------- JSON 反映 ---------- */
  function apply(d) {
    if (d.years) YEARS = d.years;
    if (d.makers) {
      ORIGIN = {};
      Object.keys(d.makers).forEach(function (k) { ORIGIN[k] = d.makers[k].origin; });
      root.querySelectorAll('[data-bar]').forEach(function (row) {
        var m = d.makers[row.dataset.bar], el = row.querySelector('[data-name]');
        if (m && el) el.textContent = m.name;
      });
    }
    if (d.kpis) root.querySelectorAll('[data-kpi]').forEach(function (el) {
      var k = d.kpis[el.dataset.kpi];
      if (!k) return;
      el.dataset.count = k.value;
      el.dataset.decimals = k.decimals != null ? k.decimals : 0;
      if (el.dataset.played) el.textContent = Number(k.value).toFixed(el.dataset.decimals);
    });
    if (d.share) { SHARE = d.share; renderWaffle(); renderLegend(d.share); setup(); }
    if (d.regions) renderRegions(d.regions);
    if (d.models) renderModels(d.models);
    if (d.years && d.trendSeries) renderTrend(d);
    if (d.meta && d.meta.note) {
      var note = root.querySelector('[data-note]');
      if (note) note.textContent = d.meta.note;
    }
    var latest = (d.meta && d.meta.latestYear) || year;
    year = null;
    setYear(YEARS[latest] ? latest : Object.keys(YEARS).sort().pop());
  }

  function renderLegend(share) {
    var rows = root.querySelectorAll('[data-legend] > div');
    share.forEach(function (s, i) {
      var row = rows[i];
      if (!row) return;
      if (row.children[0]) row.children[0].style.background = s.color;
      if (row.children[1]) row.children[1].textContent = s.name;
      if (row.children[2]) row.children[2].textContent = s.pct + '%';
    });
  }

  function renderRegions(regions) {
    var cols = root.querySelectorAll('[data-regions] > div');
    regions.forEach(function (r, i) {
      var col = cols[i];
      if (!col) return;
      var val = col.children[0], bar = col.children[1], label = col.children[2];
      if (val) { val.textContent = r.pct + '%'; val.style.color = r.color; }
      if (bar) { bar.style.height = r.pct + '%'; bar.style.background = 'linear-gradient(180deg, ' + r.color + ', ' + r.color + '55)'; }
      if (label) label.textContent = r.name;
    });
  }

  function renderModels(models) {
    var rows = root.querySelectorAll('[data-models] > div');
    models.forEach(function (m, i) {
      var row = rows[i];
      if (!row) return;
      if (row.children[1]) row.children[1].textContent = m.name;
      if (row.children[2]) row.children[2].textContent = m.value;
    });
  }

  function renderTrend(d) {
    var yrs = Object.keys(d.years).sort();
    var max = (d.meta && d.meta.trendMax) || 240;
    var x = function (i) { return 80 + (880 / Math.max(yrs.length - 1, 1)) * i; };
    var y = function (v) { return 340 - (v / max) * 280; };
    d.trendSeries.forEach(function (k) {
      var pts = yrs.map(function (yr, i) { return x(i).toFixed(1) + ',' + y(d.years[yr][k]).toFixed(1); });
      var path = root.querySelector('[data-series="' + k + '"]');
      if (path) path.setAttribute('d', 'M' + pts.join(' L'));
      var last = d.years[yrs[yrs.length - 1]][k];
      var dot = root.querySelector('[data-dot="' + k + '"]');
      if (dot) { dot.setAttribute('cx', x(yrs.length - 1)); dot.setAttribute('cy', y(last).toFixed(1)); }
      var lab = root.querySelector('[data-endlabel="' + k + '"]');
      if (lab) { lab.textContent = Math.round(last); lab.setAttribute('y', (y(last) - 18).toFixed(1)); }
    });
    // X軸ラベル
    var ticks = root.querySelectorAll('[data-xlabels] text');
    yrs.forEach(function (yr, i) { if (ticks[i]) { ticks[i].textContent = yr; ticks[i].setAttribute('x', x(i)); } });
  }

  /* ---------- 起動 ---------- */
  renderWaffle();
  setup();
  year = 2025;
  if (yearBar) yearBar.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-year]');
    if (btn) setYear(parseInt(btn.dataset.year, 10));
  });

  fetch(DATA_URL, { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(apply)
    .catch(function (e) { console.warn('[ev] ' + DATA_URL + ' を読めませんでした。初期値を表示します。', e); });
})();

/* -------- 2026年 月別推移グラフ -------- */
(function () {
  'use strict';
  var MONTHLY_URL = 'data/monthly2026.json';

  function renderMonthly2026(d) {
    var svg = document.getElementById('ev-2026-chart');
    if (!svg) return;
    var months = d.meta.months; // [1..8]
    var makers = d.makers;
    var colors = d.colors;
    var labels = d.labels;
    var monthly = d.monthly;
    var cumulative = d.cumulative;

    // レイアウト定数
    var PL = 72, PR = 40, PT = 40, PB = 48;
    var W = 960, H = 360;
    var cw = W - PL - PR, ch = H - PT - PB;

    // Y軸最大値
    var maxVal = 0;
    months.forEach(function (m) {
      makers.forEach(function (k) {
        var v = (monthly[String(m)] || {})[k] || 0;
        if (v > maxVal) maxVal = v;
      });
    });
    maxVal = Math.ceil(maxVal / 1000) * 1000 + 1000;

    var xOf = function (i) { return PL + (cw / Math.max(months.length - 1, 1)) * i; };
    var yOf = function (v) { return PT + ch - (v / maxVal) * ch; };

    // グリッド
    var grid = document.getElementById('ev-2026-grid');
    grid.innerHTML = '';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (r) {
      var y = PT + ch * r;
      var val = Math.round(maxVal * (1 - r));
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', PL); line.setAttribute('x2', W - PR);
      line.setAttribute('y1', y); line.setAttribute('y2', y);
      line.setAttribute('stroke', '#1e2530'); line.setAttribute('stroke-width', '1');
      grid.appendChild(line);
      var txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', PL - 6); txt.setAttribute('y', y + 4);
      txt.setAttribute('fill', '#55616f'); txt.setAttribute('font-size', '11');
      txt.setAttribute('text-anchor', 'end');
      txt.setAttribute('font-family', "Space Grotesk, sans-serif");
      txt.textContent = val.toLocaleString();
      grid.appendChild(txt);
    });

    // X軸ラベル
    var xlabels = document.getElementById('ev-2026-xlabels');
    xlabels.innerHTML = '';
    months.forEach(function (m, i) {
      var txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', xOf(i)); txt.setAttribute('y', PT + ch + 24);
      txt.textContent = m + '月';
      xlabels.appendChild(txt);
    });

    // 折れ線＋ドット
    var linesG = document.getElementById('ev-2026-lines');
    var dotsG = document.getElementById('ev-2026-dots');
    linesG.innerHTML = ''; dotsG.innerHTML = '';
    makers.forEach(function (k) {
      var pts = months.map(function (m, i) {
        var v = (monthly[String(m)] || {})[k] || 0;
        return xOf(i).toFixed(1) + ',' + yOf(v).toFixed(1);
      });
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M' + pts.join(' L'));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', colors[k]);
      path.setAttribute('stroke-width', '2.5');
      path.setAttribute('stroke-linejoin', 'round');
      linesG.appendChild(path);
      months.forEach(function (m, i) {
        var v = (monthly[String(m)] || {})[k] || 0;
        if (v === 0) return;
        var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', xOf(i).toFixed(1));
        c.setAttribute('cy', yOf(v).toFixed(1));
        c.setAttribute('r', '4');
        c.setAttribute('fill', colors[k]);
        dotsG.appendChild(c);
      });
    });

    // 凡例
    var legendEl = document.getElementById('ev-2026-legend');
    if (legendEl) {
      legendEl.innerHTML = '';
      makers.forEach(function (k) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px';
        var dot = document.createElement('span');
        dot.style.cssText = 'width:10px;height:10px;border-radius:50%;flex-shrink:0;background:' + colors[k];
        var name = document.createElement('span');
        name.style.color = '#c3ccd8';
        name.textContent = labels[k];
        row.appendChild(dot); row.appendChild(name);
        legendEl.appendChild(row);
      });
    }

    // 累計
    var cumEl = document.getElementById('ev-2026-cumulative');
    if (cumEl) {
      cumEl.innerHTML = '';
      makers.forEach(function (k) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;gap:16px;font-size:13px';
        var name = document.createElement('span');
        name.style.color = '#8b97a8';
        name.textContent = labels[k];
        var val = document.createElement('span');
        val.style.cssText = 'font-weight:700;font-family:"Space Grotesk",sans-serif;color:' + colors[k];
        val.textContent = (cumulative[k] || 0).toLocaleString() + '台';
        row.appendChild(name); row.appendChild(val);
        cumEl.appendChild(row);
      });
    }
  }

  fetch(MONTHLY_URL, { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(renderMonthly2026)
    .catch(function (e) { console.warn('[ev] monthly2026.json を読めませんでした。', e); });
})();

/* ═══════════════════════════════════════════════════════════
 *                    星空修炼场
 * ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ══════════ 配置 ══════════
  const CONFIG = {
    owner: 'zhouwensi',
    repo: 'artisanalcoding',
    issueNumber: 17,          // ← 改成你实际的 Issue 编号
    cacheMinutes: 10,        // 缓存时间（分钟）
    maxStargazers: 30,       // 最多显示多少个 Stargazers（避免太多）
    maxForkers: 20,          // 最多显示多少个 Forkers
  };

  const API_BASE = 'https://api.github.com';
  const CACHE_KEY = 'starfield_cache';

  // ══════════ DOM ══════════
  const canvas = document.getElementById('star-canvas');
  const loading = document.getElementById('star-loading');
  const bubble = document.getElementById('star-bubble');
  const bubbleClose = document.getElementById('bubble-close');

  if (!canvas) return; // 页面上没有星空板块就跳过

  // ══════════ 工具函数 ══════════
  function getCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const age = (Date.now() - data.timestamp) / 1000 / 60;
      if (age > CONFIG.cacheMinutes) return null;
      return data.payload;
    } catch {
      return null;
    }
  }

  function setCache(payload) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        payload: payload,
      }));
    } catch { /* 忽略 */ }
  }

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }

  // ══════════ 拉取数据 ══════════
  async function fetchAllData() {
    // 检查缓存
    const cached = getCache();
    if (cached) return cached;

    const [contributors, comments, stargazers, forks] = await Promise.allSettled([
      fetchJSON(`${API_BASE}/repos/${CONFIG.owner}/${CONFIG.repo}/contributors?per_page=100`),
      fetchJSON(`${API_BASE}/repos/${CONFIG.owner}/${CONFIG.repo}/issues/${CONFIG.issueNumber}/comments?per_page=100`),
      fetchJSON(`${API_BASE}/repos/${CONFIG.owner}/${CONFIG.repo}/stargazers?per_page=${CONFIG.maxStargazers}`),
      fetchJSON(`${API_BASE}/repos/${CONFIG.owner}/${CONFIG.repo}/forks?per_page=${CONFIG.maxForkers}`),
    ]);

    const payload = {
      contributors: contributors.status === 'fulfilled' ? contributors.value : [],
      comments: comments.status === 'fulfilled' ? comments.value : [],
      stargazers: stargazers.status === 'fulfilled' ? stargazers.value : [],
      forks: forks.status === 'fulfilled' ? forks.value : [],
    };

    setCache(payload);
    return payload;
  }

  // ══════════ 去重 & 构建星星数据 ══════════
  function buildStars(data) {
    const seen = new Set();
    const stars = [];

    // 优先级 1：Contributors（大星）
    (data.contributors || []).forEach(c => {
      if (!c.login || c.login.includes('[bot]')) return; // 过滤 bot
      seen.add(c.login.toLowerCase());
      stars.push({
        type: 'contributor',
        login: c.login,
        avatar: c.avatar_url,
        contributions: c.contributions,
        message: `贡献了 ${c.contributions} 次提交`,
        role: '⚔️ 代码贡献者',
      });
    });

    // 优先级 2：Issue 签到者（中星）
    (data.comments || []).forEach(c => {
      if (!c.user || !c.user.login) return;
      const login = c.user.login.toLowerCase();
      if (seen.has(login)) return; // 已经是贡献者，跳过
      seen.add(login);
      stars.push({
        type: 'commenter',
        login: c.user.login,
        avatar: c.user.avatar_url,
        message: c.body ? c.body.substring(0, 120) : '路过此地',
        role: '📜 签到修炼者',
        date: c.created_at,
      });
    });

    // 优先级 3：Stargazers（小光点）
    (data.stargazers || []).forEach(s => {
      if (!s.login) return;
      const login = s.login.toLowerCase();
      if (seen.has(login)) return;
      seen.add(login);
      stars.push({
        type: 'stargazer',
        login: s.login,
        avatar: s.avatar_url,
        message: '⭐ 为此仓库点亮了星光',
        role: '✨ 星光守护者',
      });
    });

    // 优先级 4：Forkers（小光点）
    (data.forks || []).forEach(f => {
      const owner = f.owner;
      if (!owner || !owner.login) return;
      const login = owner.login.toLowerCase();
      if (seen.has(login)) return;
      seen.add(login);
      stars.push({
        type: 'forker',
        login: owner.login,
        avatar: owner.avatar_url,
        message: '🍴 带走了一份古法秘籍',
        role: '📦 传承者',
      });
    });

    return stars;
  }

  // ══════════ 渲染星星 ══════════
  function renderStars(stars) {
    // 清空
    loading.style.display = 'none';

    const canvasRect = canvas.getBoundingClientRect();
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;

    // 预生成位置，避免重叠
    const positions = generatePositions(stars.length, W, H);

    stars.forEach((star, i) => {
      const dot = document.createElement('div');
      dot.className = `star-dot star-${star.type}`;

      // 位置
      const pos = positions[i];
      dot.style.left = pos.x + 'px';
      dot.style.top = pos.y + 'px';

      // 随机动画延迟，让呼吸效果错开
      dot.style.animationDelay = (Math.random() * 5).toFixed(2) + 's';

      // 贡献者的星星根据提交次数变大
      if (star.type === 'contributor' && star.contributions) {
        const scale = Math.min(1 + star.contributions * 0.03, 2.5);
        dot.style.transform = `scale(${scale})`;
      }

      // Tooltip
      dot.title = star.login;

      // 点击
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        showBubble(star, e);
      });

      canvas.appendChild(dot);
    });

    // 如果没有星星，显示提示
    if (stars.length === 0) {
      loading.innerHTML = '<span class="pixel-font" style="color:#555;">暂无星辰… 成为第一位修炼者？</span>';
      loading.style.display = 'flex';
    }
  }

  // 生成不重叠的随机位置
  function generatePositions(count, W, H) {
    const positions = [];
    const padding = 20;
    const minDist = 18; // 最小间距

    for (let i = 0; i < count; i++) {
      let x, y, attempts = 0;
      do {
        x = padding + Math.random() * (W - padding * 2);
        y = padding + Math.random() * (H - padding * 2);
        attempts++;
      } while (attempts < 100 && positions.some(p =>
        Math.hypot(p.x - x, p.y - y) < minDist
      ));
      positions.push({ x, y });
    }

    return positions;
  }

  // ══════════ 气泡 ══════════
  function showBubble(star, event) {
    document.getElementById('bubble-avatar').src = star.avatar;
    document.getElementById('bubble-name').textContent = star.login;
    document.getElementById('bubble-role').textContent = star.role;
    document.getElementById('bubble-message').textContent = star.message;

    const dateEl = document.getElementById('bubble-date');
    if (star.date) {
      const d = new Date(star.date);
      dateEl.textContent = d.toLocaleDateString('zh-CN');
    } else {
      dateEl.textContent = '';
    }

    // 定位气泡
    bubble.classList.remove('hidden');

    // 计算位置：优先在点击位置附近
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    let left = event.clientX + 15;
    let top = event.clientY - bh / 2;

    // 防止溢出屏幕
    if (left + bw > window.innerWidth - 10) {
      left = event.clientX - bw - 15;
    }
    if (top < 10) top = 10;
    if (top + bh > window.innerHeight - 10) {
      top = window.innerHeight - bh - 10;
    }

    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
  }

  function hideBubble() {
    bubble.classList.add('hidden');
  }

  // 关闭气泡
  bubbleClose.addEventListener('click', hideBubble);
  document.addEventListener('click', (e) => {
    if (!bubble.contains(e.target) && !e.target.classList.contains('star-dot')) {
      hideBubble();
    }
  });

  // ══════════ 更新统计 ══════════
  function updateStats(data) {
    const el = (id) => document.getElementById(id);
    const contributors = (data.contributors || []).filter(c => !c.login?.includes('[bot]'));
    el('stat-contributors').textContent = `${contributors.length} 位贡献者`;
    el('stat-comments').textContent = `${(data.comments || []).length} 位签到者`;
    el('stat-stargazers').textContent = `${(data.stargazers || []).length} 次 Star`;
    el('stat-forks').textContent = `${(data.forks || []).length} 次 Fork`;
  }

  // ══════════ 初始化 ══════════
  async function init() {
    try {
      const data = await fetchAllData();
      const stars = buildStars(data);
      renderStars(stars);
      updateStats(data);
    } catch (err) {
      console.error('星空加载失败:', err);
      loading.innerHTML = '<span class="pixel-font" style="color:#e06c75;">✕ 星辰召唤失败，请刷新重试</span>';
    }
  }

  // DOM ready 后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

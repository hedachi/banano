let currentFilter = 'favorites';
let currentImageId = null;
let currentImageData = null;
let currentView = 'gallery'; // gallery, detail
let reviewChildren = [];
let reviewIndex = 0;

// --- プロンプト履歴 (localStorage, 直近5件) ---

function getPromptHistory() {
  try { return JSON.parse(localStorage.getItem('prompt-history') || '[]'); } catch { return []; }
}

function savePromptToHistory(prompt) {
  let history = getPromptHistory().filter(p => p !== prompt);
  history.unshift(prompt);
  if (history.length > 5) history = history.slice(0, 5);
  localStorage.setItem('prompt-history', JSON.stringify(history));
}

function renderPromptHistory(containerId, textareaId) {
  const container = document.getElementById(containerId);
  const history = getPromptHistory();
  if (history.length === 0) { container.innerHTML = ''; return; }
  container.innerHTML = history.map(p =>
    `<span class="prompt-chip" onclick="document.getElementById('${textareaId}').value=this.dataset.prompt" data-prompt="${p.replace(/"/g, '&quot;')}">${p.length > 40 ? p.slice(0, 40) + '...' : p}</span>`
  ).join('');
}

// --- ギャラリー ---

async function loadGallery() {
  const res = await fetch(`/api/images?filter=${currentFilter}`);
  const images = await res.json();
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('empty-state');

  if (images.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  grid.innerHTML = images.map(img => `
    <div class="img-card" onclick="showDetail('${img.id}')">
      <img src="/uploads/${img.filename}" loading="lazy">
      ${img.is_favorite ? '<span class="fav-badge">&#9733;</span>' : ''}
      ${img.descendant_count > 0 ? `<span class="badge">${img.descendant_count}</span>` : ''}
    </div>
  `).join('');
}

function switchTab(el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  currentFilter = el.dataset.filter;
  loadGallery();
}

function hideAllViews() {
  ['gallery-view', 'detail-view'].forEach(id =>
    document.getElementById(id).classList.add('hidden'));
}

function goBack() {
  showGallery();
}

function showGallery() {
  hideAllViews();
  document.getElementById('gallery-view').classList.remove('hidden');
  document.getElementById('header-back').classList.add('hidden');
  document.getElementById('header-title').textContent = 'Banano';
  currentView = 'gallery';
  currentImageId = null;
  currentImageData = null;
  loadGallery();
}

// --- アップロード ---

async function uploadImage(file) {
  if (!file) return;
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const img = await res.json();
  showDetail(img.id);
}

// --- 詳細画面 ---

function favBtnHtml(id, isFav) {
  return `<span class="fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${id}', this)"><span class="star">${isFav ? '&#9733;' : '&#9734;'}</span> ${isFav ? 'お気に入り' : 'お気に入りに追加'}</span>`;
}

async function showDetail(id) {
  currentView = 'detail';

  hideAllViews();
  document.getElementById('detail-view').classList.remove('hidden');
  document.getElementById('header-back').classList.remove('hidden');

  if (id === null) {
    currentImageId = null;
    currentImageData = null;
    document.getElementById('header-title').textContent = '新規生成';
    document.getElementById('parent-section').classList.add('hidden');
    document.getElementById('selected-section').classList.add('hidden');
    document.getElementById('children-section').classList.add('hidden');
    document.getElementById('gen-count').value = '1';
  } else {
    const res = await fetch(`/api/images/${id}`);
    const data = await res.json();
    currentImageId = id;
    currentImageData = data;
    document.getElementById('header-title').textContent = '';
    document.getElementById('selected-section').classList.remove('hidden');

    // 親画像
    const parentSection = document.getElementById('parent-section');
    if (data.parent) {
      parentSection.classList.remove('hidden');
      document.getElementById('parent-thumb').innerHTML = `<img src="/uploads/${data.parent.filename}">`;
    } else {
      parentSection.classList.add('hidden');
    }

    // 選択画像
    document.getElementById('selected-image').innerHTML = `<img src="/uploads/${data.filename}">`;
    document.getElementById('selected-fav-wrap').innerHTML = favBtnHtml(data.id, data.is_favorite);

    const promptEl = document.getElementById('selected-prompt');
    if (data.prompt) {
      promptEl.textContent = data.prompt;
      promptEl.classList.remove('hidden');
    } else {
      promptEl.classList.add('hidden');
    }

    const d = new Date(data.created_at);
    document.getElementById('selected-date').textContent = d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    // 子画像 (レビューUI)
    const childSection = document.getElementById('children-section');
    if (data.children.length > 0) {
      childSection.classList.remove('hidden');
      document.getElementById('children-label').textContent = `子画像 (${data.children.length})`;
      reviewChildren = data.children.map(c => ({ id: c.id, filename: c.filename, is_favorite: c.is_favorite }));
      reviewIndex = 0;
      updateReviewChild();
    } else {
      childSection.classList.add('hidden');
    }

    document.getElementById('gen-count').value = '10';
  }

  renderPromptHistory('gen-prompt-history', 'gen-prompt');
  document.getElementById('gen-prompt').value = '';
  document.getElementById('gen-progress').classList.add('hidden');
  document.getElementById('gen-btn').disabled = false;
}

function navigateToParent() {
  if (currentImageData?.parent) showDetail(currentImageData.parent.id);
}

async function toggleFavorite(id, btnEl) {
  const res = await fetch(`/api/images/${id}/favorite`, { method: 'POST' });
  const { is_favorite } = await res.json();
  btnEl.innerHTML = `<span class="star">${is_favorite ? '&#9733;' : '&#9734;'}</span> ${is_favorite ? 'お気に入り' : 'お気に入りに追加'}`;
  btnEl.classList.toggle('active', !!is_favorite);
}

// --- 子画像レビュー ---

function updateReviewChild() {
  const child = reviewChildren[reviewIndex];
  document.getElementById('children-viewer-img').src = `/uploads/${child.filename}`;
  document.getElementById('children-counter').textContent = `${reviewIndex + 1} / ${reviewChildren.length}`;

  document.getElementById('children-dots').innerHTML = reviewChildren.map((_, i) =>
    `<div class="review-dot ${i === reviewIndex ? 'active' : ''}"></div>`
  ).join('');

  const favBtn = document.getElementById('children-fav-btn');
  favBtn.innerHTML = child.is_favorite ? '&#9733; お気に入り' : '&#9734; お気に入り';
  favBtn.classList.toggle('active', !!child.is_favorite);
}

function reviewPrev() {
  if (reviewIndex > 0) { reviewIndex--; updateReviewChild(); }
}

function reviewNext() {
  if (reviewIndex < reviewChildren.length - 1) { reviewIndex++; updateReviewChild(); }
}

async function reviewToggleFav() {
  const child = reviewChildren[reviewIndex];
  const res = await fetch(`/api/images/${child.id}/favorite`, { method: 'POST' });
  const { is_favorite } = await res.json();
  child.is_favorite = is_favorite;
  updateReviewChild();
}

function reviewUseAsBase() {
  showDetail(reviewChildren[reviewIndex].id);
}

// --- 生成 ---

async function generate() {
  const prompt = document.getElementById('gen-prompt').value.trim();
  if (!prompt) return;

  savePromptToHistory(prompt);

  const count = parseInt(document.getElementById('gen-count').value);
  const temperature = parseFloat(document.getElementById('gen-temp').value);
  const aspect_ratio = document.getElementById('gen-aspect').value;

  document.getElementById('gen-btn').disabled = true;
  const progressEl = document.getElementById('gen-progress');
  const barEl = document.getElementById('gen-progress-bar');
  const textEl = document.getElementById('gen-progress-text');
  progressEl.classList.remove('hidden');
  barEl.style.width = '0%';
  textEl.textContent = '生成中... 0/' + count;

  const body = { prompt, count, temperature, aspect_ratio };
  if (currentImageId) body.parent_id = currentImageId;

  const generatedChildren = [];

  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = JSON.parse(line.slice(6));
      if (data.done) {
        document.getElementById('gen-btn').disabled = false;
        if (currentImageId) {
          await showDetail(currentImageId);
        } else if (generatedChildren.length > 0) {
          showDetail(generatedChildren[0].id);
        } else {
          showGallery();
        }
        return;
      }
      barEl.style.width = (data.completed / data.total * 100) + '%';
      textEl.textContent = `生成中... ${data.completed}/${data.total}`;
      if (data.result) {
        generatedChildren.push(data.result);
      }
    }
  }
  document.getElementById('gen-btn').disabled = false;
}

// タッチスワイプ
document.addEventListener('DOMContentLoaded', () => {
  const viewer = document.getElementById('children-viewer');
  let touchStartX = 0;
  viewer.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
  viewer.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) reviewNext();
      else reviewPrev();
    }
  });
});

// 初期読み込み
loadGallery();

let currentFilter = 'favorites';
let currentImageId = null;
let currentImageData = null;
let currentView = 'gallery'; // gallery, detail
let reviewChildren = [];
let reviewIndex = 0;
let genFormOpen = true;
let availableModels = [];

async function loadConfig() {
  const res = await fetch('/api/config');
  const { models } = await res.json();
  availableModels = models;
  const sel = document.getElementById('gen-model');
  sel.innerHTML = models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
  onModelChange();
}

function onModelChange() {
  const isOpenAI = document.getElementById('gen-model').value.startsWith('gpt-');
  document.getElementById('temp-row').classList.toggle('hidden', isOpenAI);
}

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

function renderOverlayFav(id, isFav) {
  document.getElementById('overlay-fav').innerHTML =
    `<span class="${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleMainFav('${id}')">${isFav ? '&#9733;' : '&#9734;'}</span>`;
}

async function toggleMainFav(id) {
  const res = await fetch(`/api/images/${id}/favorite`, { method: 'POST' });
  const { is_favorite } = await res.json();
  renderOverlayFav(id, is_favorite);
}

async function showDetail(id) {
  currentView = 'detail';

  hideAllViews();
  document.getElementById('detail-view').classList.remove('hidden');

  if (id === null) {
    currentImageId = null;
    currentImageData = null;
    document.getElementById('detail-back-top').classList.remove('hidden');
    document.getElementById('parent-section').classList.add('hidden');
    document.getElementById('selected-section').classList.add('hidden');
    document.getElementById('children-section').classList.add('hidden');
    document.getElementById('gen-form-toggle').classList.add('hidden');
    document.getElementById('gen-form-body').classList.remove('hidden');
    genFormOpen = true;
    setCount(1);
  } else {
    const res = await fetch(`/api/images/${id}`);
    const data = await res.json();
    currentImageId = id;
    currentImageData = data;
    document.getElementById('detail-back-top').classList.add('hidden');
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
    renderOverlayFav(data.id, data.is_favorite);

    // 子画像 (レビューUI)
    const childSection = document.getElementById('children-section');
    if (data.children.length > 0) {
      childSection.classList.remove('hidden');
      reviewChildren = data.children.map(c => ({ id: c.id, filename: c.filename, is_favorite: c.is_favorite }));
      reviewIndex = 0;
      updateReviewChild();
      // フォームを折りたたみ
      document.getElementById('gen-form-toggle').classList.remove('hidden');
      document.getElementById('gen-form-body').classList.add('hidden');
      genFormOpen = false;
      document.getElementById('gen-form-toggle').textContent = '＋ 追加生成';
    } else {
      childSection.classList.add('hidden');
      document.getElementById('gen-form-toggle').classList.add('hidden');
      document.getElementById('gen-form-body').classList.remove('hidden');
      genFormOpen = true;
    }

    setCount(10);
  }

  renderPromptHistory('gen-prompt-history', 'gen-prompt');
  document.getElementById('gen-prompt').value = '';
  document.getElementById('gen-progress').classList.add('hidden');
  document.getElementById('gen-btn').disabled = false;
}

function navigateToParent() {
  if (currentImageData?.parent) showDetail(currentImageData.parent.id);
}

function setCount(n) {
  document.getElementById('gen-count').value = n;
  document.querySelectorAll('.count-btn').forEach(b => b.classList.toggle('active', parseInt(b.textContent) === n));
}

function showCountInput() {
  document.getElementById('gen-count-btns').classList.add('hidden');
  const input = document.getElementById('gen-count');
  input.classList.remove('hidden');
  input.focus();
  input.select();
}

function hideCountInput() {
  const input = document.getElementById('gen-count');
  const v = parseInt(input.value) || 10;
  input.value = Math.max(1, Math.min(20, v));
  input.classList.add('hidden');
  document.getElementById('gen-count-btns').classList.remove('hidden');
  document.querySelectorAll('.count-btn').forEach(b => b.classList.toggle('active', parseInt(b.textContent) === parseInt(input.value)));
}

function toggleGenForm() {
  genFormOpen = !genFormOpen;
  document.getElementById('gen-form-body').classList.toggle('hidden', !genFormOpen);
  document.getElementById('gen-form-toggle').textContent = genFormOpen ? '− 閉じる' : '＋ 追加生成';
}

// --- 子画像レビュー ---

function updateReviewChild() {
  const child = reviewChildren[reviewIndex];
  document.getElementById('children-viewer-img').src = `/uploads/${child.filename}`;
  document.getElementById('children-counter').textContent = `${reviewIndex + 1} / ${reviewChildren.length}`;

  document.getElementById('children-dots').innerHTML = reviewChildren.map((_, i) =>
    `<span class="review-dot ${i === reviewIndex ? 'active' : ''}"></span>`
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
  const model = document.getElementById('gen-model').value;

  document.getElementById('gen-btn').disabled = true;
  const progressEl = document.getElementById('gen-progress');
  const barEl = document.getElementById('gen-progress-bar');
  const textEl = document.getElementById('gen-progress-text');
  progressEl.classList.remove('hidden');
  barEl.style.width = '0%';
  textEl.textContent = '生成中... 0/' + count;

  const body = { prompt, count, temperature, aspect_ratio, model };
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
loadConfig();
loadGallery();

let currentFilter = 'favorites';
let currentImageId = null;
let currentImageData = null;
let currentView = 'gallery'; // gallery, detail
let detailMode = 'normal'; // normal, review

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
  if (detailMode === 'review') {
    if (reviewState.parentImage) {
      showDetail(reviewState.parentImage.id);
    } else {
      showGallery();
    }
  } else {
    showGallery();
  }
}

function showGallery() {
  hideAllViews();
  document.getElementById('gallery-view').classList.remove('hidden');
  document.getElementById('header-back').classList.add('hidden');
  document.getElementById('header-title').textContent = 'Banano';
  currentView = 'gallery';
  currentImageId = null;
  currentImageData = null;
  detailMode = 'normal';
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

function favBtnSmallHtml(id, isFav) {
  return `<span class="fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${id}', this)"><span class="star">${isFav ? '&#9733;' : '&#9734;'}</span></span>`;
}

async function showDetail(id) {
  currentView = 'detail';
  detailMode = 'normal';

  hideAllViews();
  document.getElementById('detail-view').classList.remove('hidden');
  document.getElementById('detail-normal').classList.remove('hidden');
  document.getElementById('detail-review').classList.add('hidden');
  document.getElementById('header-back').classList.remove('hidden');

  if (id === null) {
    // ベースなし生成モード
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
      document.getElementById('parent-thumb').innerHTML =
        `<img src="/uploads/${data.parent.filename}">`;
    } else {
      parentSection.classList.add('hidden');
    }

    // 選択画像
    document.getElementById('selected-image').innerHTML =
      `<img src="/uploads/${data.filename}">`;

    // お気に入りボタン
    document.getElementById('selected-fav-wrap').innerHTML = favBtnHtml(data.id, data.is_favorite);

    const promptEl = document.getElementById('selected-prompt');
    if (data.prompt) {
      promptEl.textContent = data.prompt;
      promptEl.classList.remove('hidden');
    } else {
      promptEl.classList.add('hidden');
    }

    const d = new Date(data.created_at);
    document.getElementById('selected-date').textContent =
      d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    // 子画像
    const childSection = document.getElementById('children-section');
    if (data.children.length > 0) {
      childSection.classList.remove('hidden');
      document.getElementById('children-label').innerHTML = `子画像 (${data.children.length}) <span class="review-link" onclick="openReviewFromDetail()">レビュー</span>`;
      document.getElementById('children-grid').innerHTML = data.children.map(c => `
        <div class="img-card-wrap">
          <div class="img-card" onclick="showDetail('${c.id}')">
            <img src="/uploads/${c.filename}" loading="lazy">
            ${c.descendant_count > 0 ? `<span class="badge">${c.descendant_count}</span>` : ''}
          </div>
          ${favBtnSmallHtml(c.id, c.is_favorite)}
        </div>
      `).join('');
    } else {
      childSection.classList.add('hidden');
    }

    document.getElementById('gen-count').value = '10';
  }

  // プロンプト履歴
  renderPromptHistory('gen-prompt-history', 'gen-prompt');

  // プロンプト欄をリセット
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
  const isSmall = !btnEl.textContent.includes('お気に入り');
  if (isSmall) {
    btnEl.querySelector('.star').innerHTML = is_favorite ? '&#9733;' : '&#9734;';
  } else {
    btnEl.innerHTML = `<span class="star">${is_favorite ? '&#9733;' : '&#9734;'}</span> ${is_favorite ? 'お気に入り' : 'お気に入りに追加'}`;
  }
  btnEl.classList.toggle('active', !!is_favorite);
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

  const parentImage = currentImageId ? { id: currentImageId, filename: currentImageData.filename } : null;
  const generatedChildren = [];

  const body = { prompt, count, temperature, aspect_ratio };
  if (currentImageId) body.parent_id = currentImageId;

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
        if (generatedChildren.length > 0) {
          if (parentImage) {
            showDetailReview(parentImage, generatedChildren, prompt);
          } else {
            // ベースなし生成 → 最初の結果画像の詳細に遷移
            showDetail(generatedChildren[0].id);
          }
        } else {
          if (currentImageId) {
            await showDetail(currentImageId);
          } else {
            showGallery();
          }
        }
        return;
      }
      barEl.style.width = (data.completed / data.total * 100) + '%';
      textEl.textContent = `生成中... ${data.completed}/${data.total}`;
      if (data.result) {
        generatedChildren.push({ ...data.result, is_favorite: 0 });
      }
    }
  }
  document.getElementById('gen-btn').disabled = false;
}

// --- レビューモード (detail内) ---

let reviewState = { parentImage: null, childImages: [], currentIndex: 0, prompt: '' };

function showDetailReview(parentImage, childImages, prompt) {
  reviewState = { parentImage, childImages, currentIndex: 0, prompt };
  detailMode = 'review';

  document.getElementById('detail-normal').classList.add('hidden');
  document.getElementById('detail-review').classList.remove('hidden');
  document.getElementById('header-title').textContent = `生成結果 (${childImages.length}枚)`;

  document.getElementById('review-before-img').src = `/uploads/${parentImage.filename}`;
  document.getElementById('review-prompt').textContent = `"${prompt}"`;

  updateReviewChild();
}

function updateReviewChild() {
  const { childImages, currentIndex } = reviewState;
  const child = childImages[currentIndex];

  document.getElementById('review-after-img').src = `/uploads/${child.filename}`;
  document.getElementById('review-counter').textContent = `${currentIndex + 1} / ${childImages.length}`;

  document.getElementById('review-dots').innerHTML = childImages.map((_, i) =>
    `<div class="review-dot ${i === currentIndex ? 'active' : ''}"></div>`
  ).join('');

  const favBtn = document.getElementById('review-fav-btn');
  favBtn.innerHTML = child.is_favorite ? '&#9733; お気に入り' : '&#9734; お気に入り';
  favBtn.classList.toggle('active', !!child.is_favorite);
}

function reviewPrev() {
  if (reviewState.currentIndex > 0) {
    reviewState.currentIndex--;
    updateReviewChild();
  }
}

function reviewNext() {
  if (reviewState.currentIndex < reviewState.childImages.length - 1) {
    reviewState.currentIndex++;
    updateReviewChild();
  }
}

async function reviewToggleFav() {
  const child = reviewState.childImages[reviewState.currentIndex];
  const res = await fetch(`/api/images/${child.id}/favorite`, { method: 'POST' });
  const { is_favorite } = await res.json();
  child.is_favorite = is_favorite;
  updateReviewChild();
}

function reviewUseAsBase() {
  const child = reviewState.childImages[reviewState.currentIndex];
  showDetail(child.id);
}

function openReviewFromDetail() {
  if (!currentImageData || currentImageData.children.length === 0) return;
  const parent = { id: currentImageId, filename: currentImageData.filename };
  const children = currentImageData.children.map(c => ({ id: c.id, filename: c.filename, is_favorite: c.is_favorite }));
  const prompt = currentImageData.children[0].prompt || '';
  showDetailReview(parent, children, prompt);
}

// タッチスワイプ
document.addEventListener('DOMContentLoaded', () => {
  const afterEl = document.getElementById('review-after');
  let touchStartX = 0;
  afterEl.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
  afterEl.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) reviewNext();
      else reviewPrev();
    }
  });
});

// 初期読み込み
loadGallery();

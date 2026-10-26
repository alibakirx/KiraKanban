// Kira — Kişisel Yazılım Projeleri & Kanban İş Takip Uygulaması

const STATUS_LIST = ['planning', 'in_progress', 'testing', 'done'];
const STATUS_LABELS = {
  planning: 'Planlama',
  in_progress: 'Başlandı',
  testing: 'Test Aşamasında',
  done: 'Tamamlandı'
};

const PRIORITY_META = {
  critical: { label: '🔥 Kritik', className: 'priority-critical' },
  high: { label: '⚡ Yüksek', className: 'priority-high' },
  medium: { label: '📌 Orta', className: 'priority-medium' },
  low: { label: '🌱 Düşük', className: 'priority-low' }
};

const TYPE_META = {
  feature: '✨ Özellik',
  bug: '🐛 Bug',
  improvement: '🔧 İyileştirme',
  research: '🧪 Araştırma'
};

let state = {
  projects: [],
  tasks: [],
  counter: 0,
  activeProjectFilter: 'all',
  searchQuery: '',
  priorityFilter: 'all',
  typeFilter: 'all',
  activeDetailTaskId: null,
  formTempImageUrl: null,
  draggedTaskId: null
};

// DOM Referansları
const saveBadge = document.getElementById('saveBadge');
const projectPillsEl = document.getElementById('projectPills');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const priorityFilterEl = document.getElementById('priorityFilter');
const typeFilterEl = document.getElementById('typeFilter');
const archiveCountBadge = document.getElementById('archiveCountBadge');
const archiveAllDoneBtn = document.getElementById('archiveAllDoneBtn');

// Modallar
const taskFormModal = document.getElementById('taskFormModal');
const taskForm = document.getElementById('taskForm');
const taskDetailModal = document.getElementById('taskDetailModal');
const archiveDrawerBackdrop = document.getElementById('archiveDrawerBackdrop');
const projectsModal = document.getElementById('projectsModal');
const lightboxModal = document.getElementById('lightboxModal');
const lightboxImage = document.getElementById('lightboxImage');

// Varsayılan başlangıç verisi (Sunucusuz / Doğrudan masaüstü kullanımı için)
const DEFAULT_DB_DATA = {
  projects: [
    { id: 'proj-1', name: 'Kira Web App', color: '#B45309' },
    { id: 'proj-2', name: 'Mobil Uygulama', color: '#0F766E' },
    { id: 'proj-3', name: 'Backend API', color: '#4338CA' }
  ],
  tasks: [
    {
      id: 'task-1',
      code: 'KR-1',
      title: 'Kira Kanban panosunu keşfet ve ilk işini ekle',
      description: 'Bu örnek bir iş kartıdır. Kartın üzerine tıklayarak detayları görebilir, alt görevler (checklist) ekleyebilir, not bırakabilir veya doğrudan Ctrl+V ile ekran görüntüsü yapıştırabilirsin.',
      projectId: 'proj-1',
      status: 'planning',
      priority: 'high',
      type: 'feature',
      image: null,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checklist: [
        { id: 'chk-1', text: 'Yeni bir proje etiketi oluştur', done: false },
        { id: 'chk-2', text: 'Kartı sürükleyip "Başlandı" sütununa taşı', done: false },
        { id: 'chk-3', text: 'Bu karta bir not ekle', done: true }
      ],
      notes: [
        {
          id: 'note-1',
          text: 'Krem tema ve sunucusuz yerel veritabanı (IndexedDB) aktif edildi. localhost gerekmeden doğrudan masaüstü uygulaması olarak çalışır.',
          createdAt: new Date().toISOString()
        }
      ]
    }
  ],
  counter: 1
};

// IndexedDB Yardımcıları (Sunucusuz modda sınırsız veri ve görsel saklama)
function openLocalDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('KiraDesktopDB', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('store')) {
        db.createObjectStore('store');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadFromLocalDB() {
  try {
    const db = await openLocalDB();
    return new Promise(resolve => {
      const tx = db.transaction('store', 'readonly');
      const req = tx.objectStore('store').get('kira_state');
      req.onsuccess = () => {
        if (req.result) return resolve(req.result);
        const rawLS = localStorage.getItem('kira_backup_state');
        resolve(rawLS ? JSON.parse(rawLS) : DEFAULT_DB_DATA);
      };
      req.onerror = () => resolve(DEFAULT_DB_DATA);
    });
  } catch {
    const rawLS = localStorage.getItem('kira_backup_state');
    return rawLS ? JSON.parse(rawLS) : DEFAULT_DB_DATA;
  }
}

async function saveToLocalDB(payload) {
  try {
    localStorage.setItem('kira_backup_state', JSON.stringify(payload));
  } catch {}
  try {
    const db = await openLocalDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('store', 'readwrite');
      tx.objectStore('store').put(payload, 'kira_state');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

// Başlangıçta verileri yükle (Önce yerel IndexedDB, eğer localhost açıksa sunucu)
async function initApp() {
  try {
    let data = null;
    if (window.location.protocol.startsWith('http')) {
      try {
        const res = await fetch('/api/data');
        if (res.ok) data = await res.json();
      } catch {}
    }
    if (!data) {
      data = await loadFromLocalDB();
    }
    state.projects = data.projects || DEFAULT_DB_DATA.projects;
    state.tasks = data.tasks || [];
    state.counter = typeof data.counter === 'number' ? data.counter : state.tasks.length;
    renderAll();
    setupEventListeners();
  } catch (err) {
    console.error('Veri yüklenemedi:', err);
  }
}

// Verileri hem IndexedDB/LocalStorage'a hem de (varsa) sunucuya kaydet
async function persistState() {
  const payload = {
    projects: state.projects,
    tasks: state.tasks,
    counter: state.counter
  };
  try {
    if (saveBadge) {
      saveBadge.textContent = 'Kaydediliyor...';
      saveBadge.style.opacity = '0.8';
    }
    await saveToLocalDB(payload);
    if (window.location.protocol.startsWith('http')) {
      try {
        await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch {}
    }
    if (saveBadge) {
      saveBadge.textContent = 'Kaydedildi';
      saveBadge.style.opacity = '1';
    }
  } catch (err) {
    console.error('Kaydetme hatası:', err);
    if (saveBadge) {
      saveBadge.textContent = 'Kaydedilemedi!';
    }
  }
}

// Görseli işle (Sunucusuz modda doğrudan sıkıştırılmış Base64 DataURL olarak saklar)
async function uploadImageDataUrl(dataUrl) {
  if (window.location.protocol.startsWith('http')) {
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl })
      });
      if (res.ok) {
        const data = await res.json();
        return data.url;
      }
    } catch {}
  }
  return dataUrl;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Tüm arayüzü yenile
function renderAll() {
  renderProjectPills();
  renderBoard();
  renderArchiveBadge();
  if (!taskDetailModal.classList.contains('hidden') && state.activeDetailTaskId) {
    renderTaskDetailModal(state.activeDetailTaskId);
  }
  if (!archiveDrawerBackdrop.classList.contains('hidden')) {
    renderArchiveList();
  }
  if (!projectsModal.classList.contains('hidden')) {
    renderProjectsManageList();
  }
}

// Proje etiketlerini üst filtre çubuğunda göster
function renderProjectPills() {
  const activeTasks = state.tasks.filter(t => !t.archived);
  let html = `
    <button class="project-pill ${state.activeProjectFilter === 'all' ? 'active' : ''}" data-proj="all">
      <span>Tüm Projeler</span>
      <span style="opacity:0.75">(${activeTasks.length})</span>
    </button>
  `;

  state.projects.forEach(proj => {
    const count = activeTasks.filter(t => t.projectId === proj.id).length;
    const isActive = state.activeProjectFilter === proj.id;
    html += `
      <button class="project-pill ${isActive ? 'active' : ''}" data-proj="${proj.id}">
        <span class="project-dot" style="background:${proj.color}"></span>
        <span>${escapeHtml(proj.name)}</span>
        <span style="opacity:0.75">(${count})</span>
      </button>
    `;
  });

  projectPillsEl.innerHTML = html;

  projectPillsEl.querySelectorAll('.project-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeProjectFilter = btn.dataset.proj;
      renderAll();
    });
  });
}

// Filtrelere uyan aktif işleri döndür
function getFilteredActiveTasks() {
  const q = state.searchQuery.trim().toLowerCase();
  return state.tasks.filter(task => {
    if (task.archived) return false;
    if (state.activeProjectFilter !== 'all' && task.projectId !== state.activeProjectFilter) {
      return false;
    }
    if (state.priorityFilter !== 'all' && task.priority !== state.priorityFilter) {
      return false;
    }
    if (state.typeFilter !== 'all' && task.type !== state.typeFilter) {
      return false;
    }
    if (q) {
      const inTitle = (task.title || '').toLowerCase().includes(q);
      const inCode = (task.code || '').toLowerCase().includes(q);
      const inDesc = (task.description || '').toLowerCase().includes(q);
      const inNotes = (task.notes || []).some(n => (n.text || '').toLowerCase().includes(q));
      if (!inTitle && !inCode && !inDesc && !inNotes) return false;
    }
    return true;
  });
}

// Kanban sütunlarını ve kartlarını oluştur
function renderBoard() {
  const filtered = getFilteredActiveTasks();

  STATUS_LIST.forEach(status => {
    const colEl = document.getElementById(`col-${status}`);
    const countEl = document.getElementById(`count-${status}`);
    const tasksInCol = filtered.filter(t => t.status === status);

    countEl.textContent = tasksInCol.length;

    if (status === 'done') {
      if (tasksInCol.length > 0) {
        archiveAllDoneBtn.classList.remove('hidden');
      } else {
        archiveAllDoneBtn.classList.add('hidden');
      }
    }

    if (tasksInCol.length === 0) {
      colEl.innerHTML = `<div class="empty-column-state">Bu aşamada iş bulunmuyor</div>`;
      return;
    }

    colEl.innerHTML = tasksInCol.map(task => createTaskCardHtml(task)).join('');

    // Kart tıklama, sürükleme ve hızlı buton olaylarını bağla
    colEl.querySelectorAll('.task-card').forEach(cardEl => {
      const taskId = cardEl.dataset.id;

      // Sürükle-bırak (Drag & Drop)
      cardEl.addEventListener('dragstart', e => {
        state.draggedTaskId = taskId;
        cardEl.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      cardEl.addEventListener('dragend', () => {
        state.draggedTaskId = null;
        cardEl.classList.remove('dragging');
        document.querySelectorAll('.board-column').forEach(c => c.classList.remove('drag-over'));
      });

      // Karta tıklanınca detay & notlar modalını aç
      cardEl.addEventListener('click', e => {
        if (e.target.closest('[data-action]')) return;
        openTaskDetailModal(taskId);
      });
    });

    // Hızlı aksiyon butonları (İlerlet, Geri Al, Arşive Ekle)
    colEl.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const taskId = btn.dataset.id;
        if (action === 'move-prev') await moveTaskStep(taskId, -1);
        if (action === 'move-next') await moveTaskStep(taskId, 1);
        if (action === 'archive') await toggleArchiveTask(taskId, true);
      });
    });
  });
}

function createTaskCardHtml(task) {
  const project = state.projects.find(p => p.id === task.projectId) || {
    name: 'Genel',
    color: '#8B7355'
  };
  const prio = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const typeLabel = TYPE_META[task.type] || TYPE_META.feature;

  const notesCount = (task.notes || []).length;
  const latestNote = notesCount > 0 ? task.notes[0] : null;

  const checklist = task.checklist || [];
  const doneCheckCount = checklist.filter(c => c.done).length;

  const statusIdx = STATUS_LIST.indexOf(task.status);
  const prevStatus = statusIdx > 0 ? STATUS_LABELS[STATUS_LIST[statusIdx - 1]] : null;
  const nextStatus = statusIdx < STATUS_LIST.length - 1 ? STATUS_LABELS[STATUS_LIST[statusIdx + 1]] : null;

  return `
    <article class="task-card" draggable="true" data-id="${task.id}">
      <div class="card-top-row">
        <span class="card-project-tag" style="background:${project.color}">
          ${escapeHtml(project.name)}
        </span>
        <span class="card-code">${escapeHtml(task.code || '')}</span>
      </div>

      ${task.image ? `
        <div class="card-thumbnail-wrap">
          <img class="card-thumbnail" src="${task.image}" alt="${escapeHtml(task.title)}" loading="lazy" />
        </div>
      ` : ''}

      <h3 class="card-title">${escapeHtml(task.title)}</h3>

      ${task.description ? `
        <p class="card-desc-snippet">${escapeHtml(task.description)}</p>
      ` : ''}

      ${latestNote ? `
        <div class="card-latest-note" title="Son eklenen not (Tüm notları görmek için karta tıkla)">
          📝 <strong>Not:</strong> ${escapeHtml(latestNote.text)}
        </div>
      ` : ''}

      <div class="card-footer">
        <div class="card-meta-left">
          <span class="badge-pill ${prio.className}">${prio.label}</span>
          <span class="badge-pill type-badge">${typeLabel}</span>
        </div>

        <div class="card-indicators">
          ${checklist.length > 0 ? `
            <span class="indicator-item" title="Alt Görevler">
              ☑️ ${doneCheckCount}/${checklist.length}
            </span>
          ` : ''}
          <span class="indicator-item" title="Not sayısı (Görmek veya eklemek için tıkla)">
            💬 ${notesCount}
          </span>
        </div>
      </div>

      <div class="card-quick-actions">
        ${prevStatus ? `
          <button type="button" class="btn-card-step" data-action="move-prev" data-id="${task.id}" title="${prevStatus} sütununa geri taşı">
            ← ${prevStatus}
          </button>
        ` : '<span></span>'}

        ${nextStatus ? `
          <button type="button" class="btn-card-step" data-action="move-next" data-id="${task.id}" title="${nextStatus} sütununa ilerlet">
            ${nextStatus} →
          </button>
        ` : ''}
      </div>

      ${task.status === 'done' ? `
        <button type="button" class="btn-card-archive" data-action="archive" data-id="${task.id}">
          📦 Arşive Ekle
        </button>
      ` : ''}
    </article>
  `;
}

// İşi bir önceki veya bir sonraki sütuna taşı
async function moveTaskStep(taskId, delta) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  const idx = STATUS_LIST.indexOf(task.status);
  const nextIdx = idx + delta;
  if (nextIdx < 0 || nextIdx >= STATUS_LIST.length) return;
  task.status = STATUS_LIST[nextIdx];
  task.updatedAt = new Date().toISOString();
  renderAll();
  await persistState();
}

// Arşive ekle / arşivden geri yükle
async function toggleArchiveTask(taskId, archiveValue) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.archived = archiveValue;
  task.updatedAt = new Date().toISOString();
  renderAll();
  await persistState();
}

function renderArchiveBadge() {
  const archivedCount = state.tasks.filter(t => t.archived).length;
  archiveCountBadge.textContent = archivedCount;
}

// ================= İŞ DETAY & NOTLAR MODALI =================
function openTaskDetailModal(taskId) {
  state.activeDetailTaskId = taskId;
  renderTaskDetailModal(taskId);
  taskDetailModal.classList.remove('hidden');
}

function closeTaskDetailModal() {
  state.activeDetailTaskId = null;
  taskDetailModal.classList.add('hidden');
}

function renderTaskDetailModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) {
    closeTaskDetailModal();
    return;
  }

  const project = state.projects.find(p => p.id === task.projectId) || {
    name: 'Genel',
    color: '#8B7355'
  };
  const prio = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const typeLabel = TYPE_META[task.type] || TYPE_META.feature;

  // Üst rozetler
  document.getElementById('detailBadges').innerHTML = `
    <span class="card-project-tag" style="background:${project.color}">${escapeHtml(project.name)}</span>
    <span class="card-code">${escapeHtml(task.code || '')}</span>
    <span class="badge-pill ${prio.className}">${prio.label}</span>
    <span class="badge-pill type-badge">${typeLabel}</span>
    ${task.archived ? `<span class="badge-pill" style="background:#E5E7EB;color:#374151">📦 Arşivde</span>` : ''}
  `;

  // Arşiv butonu metni
  const archiveBtn = document.getElementById('archiveFromDetailBtn');
  archiveBtn.textContent = task.archived ? '📤 Arşivden Çıkar' : '📦 Arşive Ekle';

  // Başlık ve açıklama
  document.getElementById('detailTitle').textContent = task.title;
  const descEl = document.getElementById('detailDescription');
  descEl.textContent = task.description || 'Bu iş için henüz detaylı bir açıklama girilmemiş.';

  // Durum seçici (Stepper)
  document.querySelectorAll('#detailStatusStepper button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.step === task.status);
  });

  // Görsel alanı
  const imgContainer = document.getElementById('detailImageContainer');
  const imgEl = document.getElementById('detailImage');
  const imgEmpty = document.getElementById('detailImageEmpty');
  if (task.image) {
    imgEl.src = task.image;
    imgContainer.classList.remove('hidden');
    imgEmpty.classList.add('hidden');
  } else {
    imgEl.src = '';
    imgContainer.classList.add('hidden');
    imgEmpty.classList.remove('hidden');
  }

  // Alt Görevler (Checklist)
  const checklist = task.checklist || [];
  const doneCount = checklist.filter(c => c.done).length;
  const pct = checklist.length > 0 ? Math.round((doneCount / checklist.length) * 100) : 0;
  document.getElementById('checklistProgressText').textContent = `${doneCount}/${checklist.length} (%${pct})`;
  document.getElementById('checklistProgressFill').style.width = `${pct}%`;

  const checklistEl = document.getElementById('detailChecklist');
  if (checklist.length === 0) {
    checklistEl.innerHTML = `<div class="detail-empty-hint">Alt görev bulunmuyor. Aşağıdan ekleyebilirsin.</div>`;
  } else {
    checklistEl.innerHTML = checklist.map(item => `
      <div class="checklist-item ${item.done ? 'done' : ''}">
        <label>
          <input type="checkbox" data-check-id="${item.id}" ${item.done ? 'checked' : ''} />
          <span>${escapeHtml(item.text)}</span>
        </label>
        <button type="button" class="checklist-del-btn" data-del-check="${item.id}" title="Alt görevi sil">&times;</button>
      </div>
    `).join('');

    checklistEl.querySelectorAll('[data-check-id]').forEach(chk => {
      chk.addEventListener('change', async () => {
        const target = task.checklist.find(c => c.id === chk.dataset.checkId);
        if (target) {
          target.done = chk.checked;
          renderAll();
          await persistState();
        }
      });
    });

    checklistEl.querySelectorAll('[data-del-check]').forEach(delBtn => {
      delBtn.addEventListener('click', async () => {
        task.checklist = task.checklist.filter(c => c.id !== delBtn.dataset.delCheck);
        renderAll();
        await persistState();
      });
    });
  }

  // Notlar Listesi
  const notes = task.notes || [];
  document.getElementById('detailNotesCount').textContent = notes.length;
  const notesListEl = document.getElementById('detailNotesList');

  if (notes.length === 0) {
    notesListEl.innerHTML = `<div class="detail-empty-hint">Henüz not bırakılmamış. Yukarıdaki kutudan ilk notunu ekleyebilirsin.</div>`;
  } else {
    notesListEl.innerHTML = notes.map(note => `
      <div class="note-card">
        <div class="note-card-top">
          <span>🕒 ${formatDate(note.createdAt)}</span>
          <button type="button" class="note-delete-btn" data-del-note="${note.id}" title="Notu sil">Sil</button>
        </div>
        <div class="note-card-text">${escapeHtml(note.text)}</div>
      </div>
    `).join('');

    notesListEl.querySelectorAll('[data-del-note]').forEach(btn => {
      btn.addEventListener('click', async () => {
        task.notes = task.notes.filter(n => n.id !== btn.dataset.delNote);
        renderAll();
        await persistState();
      });
    });
  }
}

// ================= YENİ İŞ EKLE / DÜZENLE FORMU =================
function populateProjectSelect(selectedId) {
  const select = document.getElementById('formProject');
  select.innerHTML = state.projects.map(p => `
    <option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(p.name)}</option>
  `).join('');
}

function openTaskFormModal({ editTask = null, defaultStatus = 'planning' } = {}) {
  const titleEl = document.getElementById('taskFormTitle');
  const idInput = document.getElementById('formTaskId');
  const formTitle = document.getElementById('formTitle');
  const formStatus = document.getElementById('formStatus');
  const formPriority = document.getElementById('formPriority');
  const formType = document.getElementById('formType');
  const formDescription = document.getElementById('formDescription');
  const initialNoteGroup = document.getElementById('initialNoteGroup');
  const formInitialNote = document.getElementById('formInitialNote');

  const defaultProj = state.activeProjectFilter !== 'all'
    ? state.activeProjectFilter
    : (state.projects[0] ? state.projects[0].id : '');

  if (editTask) {
    titleEl.textContent = `İşi Düzenle (${editTask.code})`;
    idInput.value = editTask.id;
    formTitle.value = editTask.title;
    populateProjectSelect(editTask.projectId);
    formStatus.value = editTask.status;
    formPriority.value = editTask.priority || 'medium';
    formType.value = editTask.type || 'feature';
    formDescription.value = editTask.description || '';
    state.formTempImageUrl = editTask.image || null;
    initialNoteGroup.classList.add('hidden');
  } else {
    titleEl.textContent = 'Yeni İş Ekle';
    idInput.value = '';
    formTitle.value = '';
    populateProjectSelect(defaultProj);
    formStatus.value = defaultStatus;
    formPriority.value = 'medium';
    formType.value = 'feature';
    formDescription.value = '';
    formInitialNote.value = '';
    state.formTempImageUrl = null;
    initialNoteGroup.classList.remove('hidden');
  }

  updateFormImagePreview();
  taskFormModal.classList.remove('hidden');
  setTimeout(() => formTitle.focus(), 50);
}

function updateFormImagePreview() {
  const emptyEl = document.getElementById('formImageEmpty');
  const previewWrap = document.getElementById('formImagePreviewWrap');
  const previewImg = document.getElementById('formImagePreview');

  if (state.formTempImageUrl) {
    previewImg.src = state.formTempImageUrl;
    previewWrap.classList.remove('hidden');
    emptyEl.classList.add('hidden');
  } else {
    previewImg.src = '';
    previewWrap.classList.add('hidden');
    emptyEl.classList.remove('hidden');
  }
}

// ================= ARŞİV ÇEKMECESİ =================
function renderArchiveList() {
  const listEl = document.getElementById('archiveList');
  const q = (document.getElementById('archiveSearchInput').value || '').trim().toLowerCase();

  const archivedTasks = state.tasks.filter(t => {
    if (!t.archived) return false;
    if (!q) return true;
    return (
      (t.title || '').toLowerCase().includes(q) ||
      (t.code || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  });

  if (archivedTasks.length === 0) {
    listEl.innerHTML = `<div class="empty-column-state">Arşivde henüz iş bulunmuyor. Tamamlanan işleri "Arşive Ekle" butonuyla buraya gönderebilirsin.</div>`;
    return;
  }

  listEl.innerHTML = archivedTasks.map(task => {
    const project = state.projects.find(p => p.id === task.projectId) || { name: 'Genel', color: '#8B7355' };
    return `
      <div class="archive-item">
        <div class="card-top-row">
          <span class="card-project-tag" style="background:${project.color}">${escapeHtml(project.name)}</span>
          <span class="card-code">${escapeHtml(task.code || '')}</span>
        </div>
        <h4 class="card-title" style="cursor:pointer" data-open-detail="${task.id}">${escapeHtml(task.title)}</h4>
        ${task.description ? `<p class="card-desc-snippet">${escapeHtml(task.description)}</p>` : ''}
        <div class="archive-item-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-unarchive="${task.id}">📤 Panoya Geri Yükle</button>
          <button type="button" class="btn btn-danger-ghost btn-sm" data-delete-archived="${task.id}">Sil</button>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('[data-open-detail]').forEach(el => {
    el.addEventListener('click', () => openTaskDetailModal(el.dataset.openDetail));
  });

  listEl.querySelectorAll('[data-unarchive]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await toggleArchiveTask(btn.dataset.unarchive, false);
    });
  });

  listEl.querySelectorAll('[data-delete-archived]').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.tasks = state.tasks.filter(t => t.id !== btn.dataset.deleteArchived);
      renderAll();
      await persistState();
    });
  });
}

// ================= PROJE YÖNETİMİ =================
function renderProjectsManageList() {
  const listEl = document.getElementById('projectsManageList');
  listEl.innerHTML = state.projects.map(proj => {
    const count = state.tasks.filter(t => t.projectId === proj.id).length;
    return `
      <div class="project-manage-row">
        <div class="project-manage-info">
          <span class="project-dot" style="background:${proj.color};width:12px;height:12px"></span>
          <span>${escapeHtml(proj.name)}</span>
          <span style="font-size:0.75rem;color:var(--text-muted)">(${count} iş)</span>
        </div>
        ${state.projects.length > 1 ? `
          <button type="button" class="btn btn-danger-ghost btn-sm" data-del-proj="${proj.id}">Kaldır</button>
        ` : ''}
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('[data-del-proj]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const projId = btn.dataset.delProj;
      if (state.projects.length <= 1) return;
      state.projects = state.projects.filter(p => p.id !== projId);
      const fallbackId = state.projects[0].id;
      state.tasks.forEach(t => {
        if (t.projectId === projId) t.projectId = fallbackId;
      });
      if (state.activeProjectFilter === projId) state.activeProjectFilter = 'all';
      renderAll();
      await persistState();
    });
  });
}

// ================= EVENT LISTENERS =================
function setupEventListeners() {
  // Arama ve filtreler
  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value;
    clearSearchBtn.classList.toggle('hidden', !state.searchQuery);
    renderBoard();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    renderBoard();
  });

  priorityFilterEl.addEventListener('change', () => {
    state.priorityFilter = priorityFilterEl.value;
    renderBoard();
  });

  typeFilterEl.addEventListener('change', () => {
    state.typeFilter = typeFilterEl.value;
    renderBoard();
  });

  // Yeni İş Ekle butonları
  document.getElementById('newTaskBtn').addEventListener('click', () => {
    openTaskFormModal();
  });

  document.querySelectorAll('[data-quick-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      openTaskFormModal({ defaultStatus: btn.dataset.quickAdd });
    });
  });

  document.getElementById('closeTaskFormBtn').addEventListener('click', () => {
    taskFormModal.classList.add('hidden');
  });
  document.getElementById('cancelTaskFormBtn').addEventListener('click', () => {
    taskFormModal.classList.add('hidden');
  });

  // Form içinden resim seçme
  const formImageDropzone = document.getElementById('formImageDropzone');
  const formImageInput = document.getElementById('formImageInput');

  formImageDropzone.addEventListener('click', e => {
    if (e.target.id === 'removeFormImageBtn') return;
    formImageInput.click();
  });

  formImageInput.addEventListener('change', async () => {
    const file = formImageInput.files[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    state.formTempImageUrl = await uploadImageDataUrl(dataUrl);
    updateFormImagePreview();
    formImageInput.value = '';
  });

  document.getElementById('removeFormImageBtn').addEventListener('click', e => {
    e.stopPropagation();
    state.formTempImageUrl = null;
    updateFormImagePreview();
  });

  // Form kaydetme
  taskForm.addEventListener('submit', async e => {
    e.preventDefault();
    const editId = document.getElementById('formTaskId').value;
    const title = document.getElementById('formTitle').value.trim();
    const projectId = document.getElementById('formProject').value;
    const status = document.getElementById('formStatus').value;
    const priority = document.getElementById('formPriority').value;
    const type = document.getElementById('formType').value;
    const description = document.getElementById('formDescription').value.trim();
    const initialNote = document.getElementById('formInitialNote').value.trim();

    if (!title) return;

    if (editId) {
      const task = state.tasks.find(t => t.id === editId);
      if (task) {
        task.title = title;
        task.projectId = projectId;
        task.status = status;
        task.priority = priority;
        task.type = type;
        task.description = description;
        task.image = state.formTempImageUrl;
        task.updatedAt = new Date().toISOString();
      }
    } else {
      state.counter += 1;
      const newTask = {
        id: `task-${Date.now()}`,
        code: `KR-${state.counter}`,
        title,
        description,
        projectId,
        status,
        priority,
        type,
        image: state.formTempImageUrl,
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        checklist: [],
        notes: initialNote
          ? [{ id: `note-${Date.now()}`, text: initialNote, createdAt: new Date().toISOString() }]
          : []
      };
      state.tasks.unshift(newTask);
    }

    taskFormModal.classList.add('hidden');
    renderAll();
    await persistState();
  });

  // Sütunlara Sürükle-Bırak (Drag & Drop)
  document.querySelectorAll('.board-column').forEach(colEl => {
    const targetStatus = colEl.dataset.status;

    colEl.addEventListener('dragover', e => {
      e.preventDefault();
      colEl.classList.add('drag-over');
    });

    colEl.addEventListener('dragleave', () => {
      colEl.classList.remove('drag-over');
    });

    colEl.addEventListener('drop', async e => {
      e.preventDefault();
      colEl.classList.remove('drag-over');
      if (!state.draggedTaskId) return;
      const task = state.tasks.find(t => t.id === state.draggedTaskId);
      if (task && task.status !== targetStatus) {
        task.status = targetStatus;
        task.updatedAt = new Date().toISOString();
        renderAll();
        await persistState();
      }
      state.draggedTaskId = null;
    });
  });

  // Tamamlanan tüm işleri arşivle
  archiveAllDoneBtn.addEventListener('click', async () => {
    const filteredDone = getFilteredActiveTasks().filter(t => t.status === 'done');
    filteredDone.forEach(t => {
      t.archived = true;
      t.updatedAt = new Date().toISOString();
    });
    renderAll();
    await persistState();
  });

  // Detay Modalı Aksiyonları
  document.getElementById('closeDetailModalBtn').addEventListener('click', closeTaskDetailModal);

  document.querySelectorAll('#detailStatusStepper button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const task = state.tasks.find(t => t.id === state.activeDetailTaskId);
      if (!task) return;
      task.status = btn.dataset.step;
      task.updatedAt = new Date().toISOString();
      renderAll();
      await persistState();
    });
  });

  document.getElementById('editTaskFromDetailBtn').addEventListener('click', () => {
    const task = state.tasks.find(t => t.id === state.activeDetailTaskId);
    if (!task) return;
    openTaskFormModal({ editTask: task });
  });

  document.getElementById('archiveFromDetailBtn').addEventListener('click', async () => {
    const task = state.tasks.find(t => t.id === state.activeDetailTaskId);
    if (!task) return;
    await toggleArchiveTask(task.id, !task.archived);
    if (task.archived) closeTaskDetailModal();
  });

  document.getElementById('deleteTaskBtn').addEventListener('click', async () => {
    if (!state.activeDetailTaskId) return;
    state.tasks = state.tasks.filter(t => t.id !== state.activeDetailTaskId);
    closeTaskDetailModal();
    renderAll();
    await persistState();
  });

  // Detay modalından görsel ekleme / kaldırma / büyütme
  const detailImageInput = document.getElementById('detailImageInput');
  detailImageInput.addEventListener('change', async () => {
    const file = detailImageInput.files[0];
    const task = state.tasks.find(t => t.id === state.activeDetailTaskId);
    if (!file || !task) return;
    const dataUrl = await readFileAsDataUrl(file);
    task.image = await uploadImageDataUrl(dataUrl);
    renderAll();
    await persistState();
    detailImageInput.value = '';
  });

  document.getElementById('removeDetailImageBtn').addEventListener('click', async () => {
    const task = state.tasks.find(t => t.id === state.activeDetailTaskId);
    if (!task) return;
    task.image = null;
    renderAll();
    await persistState();
  });

  document.getElementById('detailImage').addEventListener('click', () => {
    const src = document.getElementById('detailImage').src;
    if (!src) return;
    lightboxImage.src = src;
    lightboxModal.classList.remove('hidden');
  });

  lightboxModal.addEventListener('click', () => {
    lightboxModal.classList.add('hidden');
  });

  // Alt Görev Ekleme
  document.getElementById('addChecklistForm').addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('newChecklistInput');
    const text = input.value.trim();
    const task = state.tasks.find(t => t.id === state.activeDetailTaskId);
    if (!text || !task) return;
    if (!task.checklist) task.checklist = [];
    task.checklist.push({ id: `chk-${Date.now()}`, text, done: false });
    input.value = '';
    renderAll();
    await persistState();
  });

  // Not Ekleme
  const addNoteForm = document.getElementById('addNoteForm');
  const newNoteInput = document.getElementById('newNoteInput');

  addNoteForm.addEventListener('submit', async e => {
    e.preventDefault();
    await submitNewNote();
  });

  newNoteInput.addEventListener('keydown', async e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      await submitNewNote();
    }
  });

  async function submitNewNote() {
    const text = newNoteInput.value.trim();
    const task = state.tasks.find(t => t.id === state.activeDetailTaskId);
    if (!text || !task) return;
    if (!task.notes) task.notes = [];
    task.notes.unshift({
      id: `note-${Date.now()}`,
      text,
      createdAt: new Date().toISOString()
    });
    task.updatedAt = new Date().toISOString();
    newNoteInput.value = '';
    renderAll();
    await persistState();
  }

  // Arşiv Çekmecesi Aç / Kapat
  document.getElementById('openArchiveBtn').addEventListener('click', () => {
    renderArchiveList();
    archiveDrawerBackdrop.classList.remove('hidden');
  });

  document.getElementById('closeArchiveDrawerBtn').addEventListener('click', () => {
    archiveDrawerBackdrop.classList.add('hidden');
  });

  document.getElementById('archiveSearchInput').addEventListener('input', renderArchiveList);

  // Proje Yönetimi Modalı
  document.getElementById('manageProjectsBtn').addEventListener('click', () => {
    renderProjectsManageList();
    projectsModal.classList.remove('hidden');
  });

  document.getElementById('closeProjectsModalBtn').addEventListener('click', () => {
    projectsModal.classList.add('hidden');
  });

  document.querySelectorAll('#colorPresets .color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.getElementById('newProjectColor').value = swatch.dataset.color;
    });
  });

  document.getElementById('addProjectForm').addEventListener('submit', async e => {
    e.preventDefault();
    const nameInput = document.getElementById('newProjectName');
    const colorInput = document.getElementById('newProjectColor');
    const name = nameInput.value.trim();
    if (!name) return;
    state.projects.push({
      id: `proj-${Date.now()}`,
      name,
      color: colorInput.value || '#B45309'
    });
    nameInput.value = '';
    renderAll();
    await persistState();
  });

  // Yedek İndir (JSON Export) & Yedek Yükle (JSON Import)
  const exportBackupBtn = document.getElementById('exportBackupBtn');
  const importBackupInput = document.getElementById('importBackupInput');

  if (exportBackupBtn) {
    exportBackupBtn.addEventListener('click', () => {
      const payload = {
        projects: state.projects,
        tasks: state.tasks,
        counter: state.counter,
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kira-yedek-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (importBackupInput) {
    importBackupInput.addEventListener('change', async () => {
      const file = importBackupInput.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data.projects) && Array.isArray(data.tasks)) {
          state.projects = data.projects;
          state.tasks = data.tasks;
          state.counter = typeof data.counter === 'number' ? data.counter : data.tasks.length;
          renderAll();
          await persistState();
        }
      } catch (err) {
        alert('Geçersiz yedek dosyası!');
      }
      importBackupInput.value = '';
    });
  }

  // CTRL+V ile Doğrudan Panodan Ekran Görüntüsü Yapıştırma
  window.addEventListener('paste', async e => {
    const items = (e.clipboardData || e.originalEvent.clipboardData || {}).items;
    if (!items) return;

    let imageFile = null;
    for (const item of items) {
      if (item.type.indexOf('image') === 0) {
        imageFile = item.getAsFile();
        break;
      }
    }
    if (!imageFile) return;

    const dataUrl = await readFileAsDataUrl(imageFile);
    const uploadedUrl = await uploadImageDataUrl(dataUrl);

    // 1. Yeni İş / Düzenleme modalı açıksa oraya ekle
    if (!taskFormModal.classList.contains('hidden')) {
      state.formTempImageUrl = uploadedUrl;
      updateFormImagePreview();
      return;
    }

    // 2. İş Detay modalı açıksa doğrudan o işe ekle
    if (!taskDetailModal.classList.contains('hidden') && state.activeDetailTaskId) {
      const task = state.tasks.find(t => t.id === state.activeDetailTaskId);
      if (task) {
        task.image = uploadedUrl;
        renderAll();
        await persistState();
      }
      return;
    }

    // 3. Hiçbir modal açık değilse yeni iş modalını bu görselle aç
    openTaskFormModal();
    state.formTempImageUrl = uploadedUrl;
    updateFormImagePreview();
  });

  // ESC tuşu ile açık modalları kapatma ve arka plana tıklama
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!lightboxModal.classList.contains('hidden')) {
        lightboxModal.classList.add('hidden');
      } else if (!taskFormModal.classList.contains('hidden')) {
        taskFormModal.classList.add('hidden');
      } else if (!taskDetailModal.classList.contains('hidden')) {
        closeTaskDetailModal();
      } else if (!archiveDrawerBackdrop.classList.contains('hidden')) {
        archiveDrawerBackdrop.classList.add('hidden');
      } else if (!projectsModal.classList.contains('hidden')) {
        projectsModal.classList.add('hidden');
      }
    }
  });

  [taskFormModal, taskDetailModal, archiveDrawerBackdrop, projectsModal].forEach(backdrop => {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) {
        backdrop.classList.add('hidden');
        if (backdrop === taskDetailModal) state.activeDetailTaskId = null;
      }
    });
  });
}

// Yardımcı Fonksiyonlar
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoStr;
  }
}

initApp();

/* ==========================================================================
   ESTUDIACCIÓN (KILONOTION) - MAIN COORDINATOR (APP.JS)
   ========================================================================== */

class CozyApp {
  constructor() {
    this.activeNotebookId = null;
    this.initNavbar();
    this.initNotebookModal();
    this.initFlashcardModal();
    this.initEventModal();
    this.initThemeSwitcher();
    this.initMobileSidebar();
    this.renderBookshelf();
  }

  // Mobile sidebar navigation toggler
  initMobileSidebar() {
    const btnToggle = document.getElementById('btn-sidebar-mobile-toggle');
    const btnClose = document.getElementById('btn-sidebar-close');
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (!btnToggle || !sidebar) return;

    const openSidebar = () => {
      sidebar.classList.add('open');
      if (overlay) overlay.classList.remove('hidden');
    };

    const closeSidebar = () => {
      sidebar.classList.remove('open');
      if (overlay) overlay.classList.add('hidden');
    };

    btnToggle.addEventListener('click', openSidebar);
    if (btnClose) btnClose.addEventListener('click', closeSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);

    // Auto-close sidebar on item navigate (only on mobile viewports)
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          closeSidebar();
        }
      });
    });
  }

  // Theme Switcher Logic
  initThemeSwitcher() {
    const select = document.getElementById('app-theme-select');
    if (select) {
      const savedTheme = localStorage.getItem('kilonotion_theme') || 'cozy';
      select.value = savedTheme;
      this.applyTheme(savedTheme);

      select.addEventListener('change', (e) => {
        const themeName = e.target.value;
        localStorage.setItem('kilonotion_theme', themeName);
        this.applyTheme(themeName);
      });
    }
  }

  applyTheme(themeName) {
    document.body.className = '';
    if (themeName === 'cozy') {
      document.body.classList.add('cozy-theme');
    } else if (themeName === 'dark') {
      document.body.classList.add('dark-theme');
    } else if (themeName === 'brutalist') {
      document.body.classList.add('brutalist-theme');
    }
  }

  // Bind tab panel switching logic
  initNavbar() {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('.menu-item');
        const targetTab = targetBtn.dataset.tab;

        // Visual active shift
        menuItems.forEach(m => m.classList.remove('active'));
        targetBtn.classList.add('active');

        this.switchTab(targetTab);
      });
    });

    // Special Back button from Notebook Editor to bookshelf
    const btnBack = document.getElementById('btn-viewer-back');
    btnBack.addEventListener('click', () => {
      // Auto-save drawings
      if (window.cozyCanvas) {
        window.cozyCanvas.saveCurrentDrawing();
      }
      this.switchTab('bookshelf-tab');
      // Restore sidebar active class
      document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
      document.getElementById('btn-tab-bookshelf').classList.add('active');
    });

    // Study notebook button inside Canvas Editor
    document.getElementById('btn-study-this-notebook').addEventListener('click', () => {
      if (this.activeNotebookId) {
        this.switchTab('flashcards-tab');
        // Shift active sidebar menu tab
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        document.getElementById('btn-tab-flashcards').classList.add('active');

        // Automatically trigger study session
        if (window.cozyFlashcards) {
          window.cozyFlashcards.startStudySession(this.activeNotebookId);
        }
      }
    });
  }

  switchTab(tabId) {
    // Hide all tabs
    const panels = document.querySelectorAll('.tab-panel');
    panels.forEach(p => p.classList.remove('active'));

    // Show selected
    const activePanel = document.getElementById(tabId);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    // Trigger specific component initializers
    if (tabId === 'bookshelf-tab') {
      this.renderBookshelf();
      this.activeNotebookId = null;
      stateManager.setActiveNotebookId(null);
    } else if (tabId === 'planner-tab') {
      if (window.cozyPlanner) {
        window.cozyPlanner.renderPlanner();
      }
    } else if (tabId === 'flashcards-tab') {
      if (window.cozyFlashcards) {
        window.cozyFlashcards.loadWelcomeDashboard();
      }
    }
  }

  /* --- BOOKSHELF RENDERER --- */
  renderBookshelf() {
    const grid = document.getElementById('bookshelf-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const notebooks = stateManager.getNotebooks();

    if (notebooks.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--color-text-muted);">
          <p style="font-size: 1.2rem; font-weight: 600;">Tu estantería está vacía 🍃</p>
          <p style="font-size: 0.9rem; margin-top: 4px;">Crea tu primer cuaderno para empezar a tomar apuntes estéticos.</p>
        </div>
      `;
      return;
    }

    // Shelves visual spacing: render notebooks and add wooden shelves!
    const itemsPerShelf = 4; // visual wraps
    
    notebooks.forEach((notebook, index) => {
      const card = document.createElement('div');
      card.className = 'notebook-card';
      
      const flashcardsCount = notebook.flashcards ? notebook.flashcards.length : 0;

      card.innerHTML = `
        <div class="notebook-book" style="background-color: ${notebook.coverColor};">
          <div class="notebook-book-icon">${notebook.icon || '📝'}</div>
          <div class="notebook-book-details">
            <h4 class="notebook-book-title">${notebook.title}</h4>
            <span class="notebook-book-subject">${notebook.subject}</span>
          </div>
        </div>
        <div class="notebook-card-info">
          <span class="notebook-card-name">${notebook.title}</span>
          <p class="notebook-card-meta">${flashcardsCount} ${flashcardsCount === 1 ? 'tarjeta' : 'tarjetas'}</p>
        </div>
      `;

      // Open notebook action
      card.addEventListener('click', () => {
        this.openNotebook(notebook.id);
      });

      grid.appendChild(card);

      // Render wood shelf decorator after every row
      if ((index + 1) % itemsPerShelf === 0 || index === notebooks.length - 1) {
        const shelf = document.createElement('div');
        shelf.className = 'bookshelf-shelf-decorator';
        grid.appendChild(shelf);
      }
    });
  }

  openNotebook(id) {
    this.activeNotebookId = id;
    stateManager.setActiveNotebookId(id);
    this.switchTab('notebook-viewer-tab');

    const notebook = stateManager.getNotebook(id);
    if (!notebook) return;

    // Load inside Editor Title
    const titleInput = document.getElementById('viewer-notebook-title');
    const subjectTag = document.getElementById('viewer-notebook-subject');

    titleInput.value = notebook.title;
    subjectTag.innerText = notebook.subject;
    subjectTag.style.backgroundColor = notebook.coverColor;

    // Save editing title changes
    titleInput.onblur = () => {
      stateManager.updateNotebook(id, { title: titleInput.value });
    };

    // Load Canvas drawings and text blocks
    if (window.cozyCanvas) {
      window.cozyCanvas.loadNotebook(id);
    }

    this.renderNotebookSidebarFlashcards();
  }

  // List notebook flashcards on the canvas editor sidebar
  renderNotebookSidebarFlashcards() {
    const list = document.getElementById('notebook-flashcards-list');
    if (!list) return;

    list.innerHTML = '';
    const notebook = stateManager.getNotebook(this.activeNotebookId);
    if (!notebook || !notebook.flashcards || notebook.flashcards.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; color: var(--color-text-muted); font-size: 0.8rem; padding: 20px 0;">
          Ninguna tarjeta de estudio creada para este cuaderno. 💡
        </div>
      `;
      return;
    }

    notebook.flashcards.forEach(c => {
      const item = document.createElement('div');
      item.className = 'sidebar-card-item';
      item.innerHTML = `
        <div class="sidebar-card-q">${c.front}</div>
        <div class="sidebar-card-a">${c.back}</div>
      `;
      list.appendChild(item);
    });
  }

  /* --- MODAL: CREATE NOTEBOOK --- */
  initNotebookModal() {
    const modal = document.getElementById('modal-create-notebook');
    const btnOpen = document.getElementById('btn-create-notebook');
    const btnClose = document.getElementById('btn-close-notebook-modal');
    const btnCancel = document.getElementById('btn-cancel-notebook-modal');
    const btnConfirm = document.getElementById('btn-confirm-create-notebook');

    if (!modal) return;

    const openModal = () => {
      modal.classList.remove('hidden');
      document.getElementById('notebook-name').value = '';
      document.getElementById('notebook-subject').value = '';
    };

    const closeModal = () => modal.classList.add('hidden');

    btnOpen.addEventListener('click', openModal);
    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    // Cover color selection
    const colorSelectors = modal.querySelectorAll('.cover-selector-btn');
    colorSelectors.forEach(btn => {
      btn.addEventListener('click', (e) => {
        colorSelectors.forEach(s => s.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    // Cover icon selection
    const iconSelectors = modal.querySelectorAll('.icon-selector-btn');
    iconSelectors.forEach(btn => {
      btn.addEventListener('click', (e) => {
        iconSelectors.forEach(s => s.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    btnConfirm.addEventListener('click', () => {
      const name = document.getElementById('notebook-name').value.trim();
      const subject = document.getElementById('notebook-subject').value.trim();
      
      const activeColorNode = modal.querySelector('.cover-selector-btn.active');
      const coverColor = activeColorNode ? activeColorNode.dataset.color : '#E8AEB7';

      const activeIconNode = modal.querySelector('.icon-selector-btn.active');
      const icon = activeIconNode ? activeIconNode.dataset.icon : '📝';

      if (!name) {
        alert('Por favor, ingresa el título del cuaderno.');
        return;
      }

      stateManager.createNotebook(name, subject, coverColor, icon);
      closeModal();
      this.renderBookshelf();
    });
  }

  /* --- MODAL: CREATE FLASHCARD --- */
  initFlashcardModal() {
    const modal = document.getElementById('modal-create-flashcard');
    const btnOpen = document.getElementById('btn-add-notebook-flashcard');
    const btnClose = document.getElementById('btn-close-flashcard-modal');
    const btnCancel = document.getElementById('btn-cancel-flashcard-modal');
    const btnConfirm = document.getElementById('btn-confirm-create-flashcard');

    if (!modal) return;

    const openModal = () => {
      if (!this.activeNotebookId) {
        alert('Por favor, abre una libreta para agregarle tarjetas de repaso.');
        return;
      }
      modal.classList.remove('hidden');
      document.getElementById('flashcard-front').value = '';
      document.getElementById('flashcard-back').value = '';
    };

    const closeModal = () => modal.classList.add('hidden');

    btnOpen.addEventListener('click', openModal);
    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    btnConfirm.addEventListener('click', () => {
      const front = document.getElementById('flashcard-front').value.trim();
      const back = document.getElementById('flashcard-back').value.trim();

      if (!front || !back) {
        alert('Por favor completa los campos de Pregunta y Respuesta.');
        return;
      }

      stateManager.addFlashcard(this.activeNotebookId, front, back);
      closeModal();
      this.renderNotebookSidebarFlashcards();
    });
  }

  /* --- MODAL: CREATE EVENT (PLANNER) --- */
  initEventModal() {
    const modal = document.getElementById('modal-create-event');
    const btnOpen = document.getElementById('btn-add-event');
    const btnClose = document.getElementById('btn-close-event-modal');
    const btnCancel = document.getElementById('btn-cancel-event-modal');
    const btnConfirm = document.getElementById('btn-confirm-create-event');

    if (!modal) return;

    const openModal = () => {
      this.populateNotebooksDropdown();
      modal.classList.remove('hidden');
      document.getElementById('event-title').value = '';
      document.getElementById('event-date').value = new Date().toISOString().split('T')[0];
    };

    const closeModal = () => modal.classList.add('hidden');

    btnOpen.addEventListener('click', openModal);
    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    btnConfirm.addEventListener('click', () => {
      const title = document.getElementById('event-title').value.trim();
      const date = document.getElementById('event-date').value;
      const notebookId = document.getElementById('event-notebook-assoc').value;
      const type = document.getElementById('event-type').value;

      if (!title) {
        alert('Por favor ingresa un título para la entrega o examen.');
        return;
      }

      stateManager.createEvent(title, date, notebookId, type);
      closeModal();

      if (window.cozyPlanner) {
        window.cozyPlanner.renderPlanner();
      }
    });
  }

  populateNotebooksDropdown() {
    const select = document.getElementById('event-notebook-assoc');
    if (!select) return;
    select.innerHTML = '<option value="">Sin vincular (General)</option>';
    const notebooks = stateManager.getNotebooks();
    notebooks.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n.id;
      opt.innerText = n.title;
      select.appendChild(opt);
    });
  }
}

// Instantiate App
window.addEventListener('DOMContentLoaded', () => {
  window.cozyApp = new CozyApp();
});

/* ==========================================================================
   ESTUDIACCIÓN (KILONOTION) - STATE MANAGER (LOCALSTORAGE PERSISTENCE)
   ========================================================================== */

const KILONOTION_STORAGE_KEY = 'kilonotion_cozy_state';

class StateManager {
  constructor() {
    this.loadState();
  }

  // Load state from LocalStorage or initialize with beautiful default data
  loadState() {
    const serializedState = localStorage.getItem(KILONOTION_STORAGE_KEY);
    if (serializedState) {
      try {
        this.state = JSON.parse(serializedState);
        
        // Defensive check: ensure imageBlocks array is initialized on all notebooks
        if (this.state.notebooks) {
          this.state.notebooks.forEach(n => {
            if (!n.imageBlocks) n.imageBlocks = [];
            if (n.textBlocks) {
              n.textBlocks.forEach(tb => {
                if (tb.transparent === undefined) tb.transparent = false;
              });
            }
          });
        }
        
        // Defensive check: ensure the tutorial notebook is present and up-to-date!
        const hasTutorial = this.state.notebooks && this.state.notebooks.some(n => n.id === 'notebook-tutorial');
        const isUpToDate = hasTutorial && this.state.notebooks.some(n => n.textBlocks && n.textBlocks.some(b => b.id === 'tb-tut-4'));
        
        if (!hasTutorial || !isUpToDate) {
          // Remove old tutorial if exists
          if (this.state.notebooks) {
            this.state.notebooks = this.state.notebooks.filter(n => n.id !== 'notebook-tutorial');
          }
          this.state.notebooks.unshift({
            id: 'notebook-tutorial',
            title: '📖 Guía de Inicio (Tutorial)',
            subject: '¡Léeme Primero! ✨',
            coverColor: '#F2CC8F',
            icon: '📖',
            paperStyle: 'lines',
            drawData: null,
            textBlocks: [
              { id: 'tb-tut-1', text: '✨ ¡BIENVENIDO A ESTUDIACCIÓN! ✨\nEsta libreta es tu guía interactiva rápida.', x: 100, y: 80 },
              { id: 'tb-tut-2', text: '📝 FUNCIÓN DE TEXTO (Estilo Notion):\n1. Selecciona la herramienta "T" en la barra de arriba.\n2. Haz un solo clic en cualquier parte del papel y escribe.\n3. O haz doble clic directamente con cualquier herramienta.\n👉 ¡Pasa el ratón por este bloque! Verás un tirador de arrastre ( ⋮⋮ ) a la izquierda. Haz clic en él y arrastra para mover el bloque.', x: 100, y: 220 },
              { id: 'tb-tut-3', text: '✋ FUNCIÓN DE MANO (Desplazamiento):\n¿Quieres mover la página?\n1. Selecciona el ícono de la Mano (✋) arriba.\n2. Haz clic en el lienzo y arrastra para mover la página infinitamente.\n¡Ideal para pantallas táctiles y repasar apuntes grandes!', x: 100, y: 440 },
              { id: 'tb-tut-4', text: '↩️ DESHACER CON CTRL+Z:\n¿Hiciste un trazo erróneo con el lápiz?\nPresiona Ctrl + Z en tu teclado o haz clic en el botón de la flecha curvada (Deshacer) de la barra superior. ¡Tu historial de trazos se guardará al instante!', x: 100, y: 660 }
            ],
            imageBlocks: [],
            flashcards: [
              { id: 'f-tut-1', front: '¿Cómo muevo los bloques de texto en el lienzo?', back: 'Pasando el cursor sobre el bloque, haciendo clic y arrastrando desde el tirador vertical "⋮⋮" de la izquierda.', difficulty: 'easy', reviews: 1 },
              { id: 'f-tut-2', front: '¿Cómo me desplazo por la página si no cabe en pantalla?', back: 'Seleccionando la herramienta de la Mano (✋) y arrastrando el papel.', difficulty: 'medium', reviews: 0 }
            ]
          });
          
          if (this.state.events && !this.state.events.some(e => e.notebookAssoc === 'notebook-tutorial')) {
            this.state.events.unshift({ id: 'e1', title: 'Completar Tutorial de Inicio 📖', date: new Date().toISOString().split('T')[0], notebookAssoc: 'notebook-tutorial', type: 'reading', completed: false });
          }
          this.saveState();
        }
        return;
      } catch (e) {
        console.error("Error reading saved state, initializing default state.", e);
      }
    }

    // Default state for university students
    this.state = {
      notebooks: [
        {
          id: 'notebook-tutorial',
          title: '📖 Guía de Inicio (Tutorial)',
          subject: '¡Léeme Primero! ✨',
          coverColor: '#F2CC8F',
          icon: '📖',
          paperStyle: 'lines',
          drawData: null,
          textBlocks: [
            { id: 'tb-tut-1', text: '✨ ¡BIENVENIDO A ESTUDIACCIÓN! ✨\nEsta libreta es tu guía interactiva rápida.', x: 100, y: 80 },
            { id: 'tb-tut-2', text: '📝 FUNCIÓN DE TEXTO (Estilo Notion):\n1. Selecciona la herramienta "T" en la barra de arriba.\n2. Haz un solo clic en cualquier parte del papel y escribe.\n3. O haz doble clic directamente con cualquier herramienta.\n👉 ¡Pasa el ratón por este bloque! Verás un tirador de arrastre ( ⋮⋮ ) a la izquierda. Haz clic en él y arrastra para mover el bloque.', x: 100, y: 220 },
            { id: 'tb-tut-3', text: '✋ FUNCIÓN DE MANO (Desplazamiento):\n¿Quieres mover la página?\n1. Selecciona el ícono de la Mano (✋) arriba.\n2. Haz clic en el lienzo y arrastra para mover la página infinitamente.\n¡Ideal para pantallas táctiles y repasar apuntes grandes!', x: 100, y: 440 },
            { id: 'tb-tut-4', text: '↩️ DESHACER CON CTRL+Z:\n¿Hiciste un trazo erróneo con el lápiz?\nPresiona Ctrl + Z en tu teclado o haz clic en el botón de la flecha curvada (Deshacer) de la barra superior. ¡Tu historial de trazos se guardará al instante!', x: 100, y: 660 }
          ],
          imageBlocks: [],
          flashcards: [
            { id: 'f-tut-1', front: '¿Cómo muevo los bloques de texto en el lienzo?', back: 'Pasando el cursor sobre el bloque, haciendo clic y arrastrando desde el tirador vertical "⋮⋮" de la izquierda.', difficulty: 'easy', reviews: 1 },
            { id: 'f-tut-2', front: '¿Cómo me desplazo por la página si no cabe en pantalla?', back: 'Seleccionando la herramienta de la Mano (✋) y arrastrando el papel.', difficulty: 'medium', reviews: 0 }
          ]
        },
        {
          id: 'notebook-physics',
          title: 'Física Universitaria',
          subject: 'Semestre I',
          coverColor: '#A8DADC',
          icon: '📐',
          paperStyle: 'grid',
          drawData: null, // base64 string of canvas drawing
          textBlocks: [
            { id: 't1', text: 'Temas para Examen Parcial:\n1. Cinemática vectorial\n2. Dinámica de partículas\n3. Trabajo y Energía', x: 100, y: 120 }
          ],
          imageBlocks: [],
          flashcards: [
            { id: 'f-p1', front: '¿Qué enuncia la Primera Ley de Newton?', back: 'Todo cuerpo permanece en estado de reposo o movimiento uniforme a menos que una fuerza neta actúe sobre él.', difficulty: 'easy', reviews: 1 }
          ]
        }
      ],
      events: [
        { id: 'e1', title: 'Completar Tutorial de Inicio 📖', date: new Date().toISOString().split('T')[0], notebookAssoc: 'notebook-tutorial', type: 'reading', completed: false },
        { id: 'e2', title: 'Entrega Laboratorio Física 📐', date: '2026-05-28', notebookAssoc: 'notebook-physics', type: 'assignment', completed: false }
      ],
      activeTab: 'bookshelf-tab',
      activeNotebookId: null
    };
    this.saveState();
  }

  // Save current state to LocalStorage
  saveState() {
    localStorage.setItem(KILONOTION_STORAGE_KEY, JSON.stringify(this.state));
  }

  /* --- NOTEBOOKS METHODS --- */
  getNotebooks() {
    return this.state.notebooks;
  }

  getNotebook(id) {
    return this.state.notebooks.find(n => n.id === id);
  }

  createNotebook(title, subject, coverColor, icon) {
    const newNotebook = {
      id: 'notebook-' + Date.now(),
      title: title || 'Sin Título',
      subject: subject || 'General',
      coverColor: coverColor || '#E8AEB7',
      icon: icon || '📝',
      paperStyle: 'grid',
      drawData: null,
      textBlocks: [],
      imageBlocks: [],
      flashcards: []
    };
    this.state.notebooks.push(newNotebook);
    this.saveState();
    return newNotebook;
  }

  updateNotebook(id, updates) {
    const notebook = this.getNotebook(id);
    if (notebook) {
      Object.assign(notebook, updates);
      this.saveState();
    }
  }

  deleteNotebook(id) {
    this.state.notebooks = this.state.notebooks.filter(n => n.id !== id);
    // Also remove associated events
    this.state.events = this.state.events.filter(e => e.notebookAssoc !== id);
    if (this.state.activeNotebookId === id) {
      this.state.activeNotebookId = null;
      this.state.activeTab = 'bookshelf-tab';
    }
    this.saveState();
  }

  /* --- CANVAS & TEXT BLOCKS IN NOTEBOOK --- */
  saveNotebookCanvas(id, drawData) {
    const notebook = this.getNotebook(id);
    if (notebook) {
      notebook.drawData = drawData;
      this.saveState();
    }
  }

  addTextBlock(notebookId, text, x, y, transparent) {
    const notebook = this.getNotebook(notebookId);
    if (notebook) {
      const newBlock = {
        id: 'block-' + Date.now(),
        text: text || '',
        x: x || 100,
        y: y || 100,
        transparent: !!transparent
      };
      notebook.textBlocks.push(newBlock);
      this.saveState();
      return newBlock;
    }
    return null;
  }

  updateTextBlock(notebookId, blockId, text, x, y, transparent) {
    const notebook = this.getNotebook(notebookId);
    if (notebook) {
      const block = notebook.textBlocks.find(b => b.id === blockId);
      if (block) {
        if (text !== undefined) block.text = text;
        if (x !== undefined) block.x = x;
        if (y !== undefined) block.y = y;
        if (transparent !== undefined) block.transparent = transparent;
        this.saveState();
      }
    }
  }

  deleteTextBlock(notebookId, blockId) {
    const notebook = this.getNotebook(notebookId);
    if (notebook) {
      notebook.textBlocks = notebook.textBlocks.filter(b => b.id !== blockId);
      this.saveState();
    }
  }

  /* --- IMAGE BLOCKS IN NOTEBOOK --- */
  addImageBlock(notebookId, src, x, y, width, height) {
    const notebook = this.getNotebook(notebookId);
    if (notebook) {
      if (!notebook.imageBlocks) notebook.imageBlocks = [];
      const newBlock = {
        id: 'img-' + Date.now(),
        src: src || '',
        x: x || 100,
        y: y || 100,
        width: width || 250,
        height: height || 200
      };
      notebook.imageBlocks.push(newBlock);
      this.saveState();
      return newBlock;
    }
    return null;
  }

  updateImageBlock(notebookId, blockId, updates) {
    const notebook = this.getNotebook(notebookId);
    if (notebook) {
      if (!notebook.imageBlocks) notebook.imageBlocks = [];
      const block = notebook.imageBlocks.find(b => b.id === blockId);
      if (block) {
        Object.assign(block, updates);
        this.saveState();
      }
    }
  }

  deleteImageBlock(notebookId, blockId) {
    const notebook = this.getNotebook(notebookId);
    if (notebook) {
      if (!notebook.imageBlocks) notebook.imageBlocks = [];
      notebook.imageBlocks = notebook.imageBlocks.filter(b => b.id !== blockId);
      this.saveState();
    }
  }

  /* --- FLASHCARDS METHODS --- */
  addFlashcard(notebookId, front, back) {
    const notebook = this.getNotebook(notebookId);
    if (notebook) {
      const newCard = {
        id: 'card-' + Date.now(),
        front: front || '',
        back: back || '',
        difficulty: 'medium', // 'easy', 'medium', 'hard'
        reviews: 0
      };
      notebook.flashcards.push(newCard);
      this.saveState();
      return newCard;
    }
    return null;
  }

  updateFlashcardDifficulty(notebookId, cardId, difficulty) {
    const notebook = this.getNotebook(notebookId);
    if (notebook) {
      const card = notebook.flashcards.find(c => c.id === cardId);
      if (card) {
        card.difficulty = difficulty;
        card.reviews += 1;
        this.saveState();
      }
    }
  }

  deleteFlashcard(notebookId, cardId) {
    const notebook = this.getNotebook(notebookId);
    if (notebook) {
      notebook.flashcards = notebook.flashcards.filter(c => c.id !== cardId);
      this.saveState();
    }
  }

  getAllFlashcardsCount() {
    let total = 0;
    let reviewed = 0;
    let easy = 0;
    this.state.notebooks.forEach(n => {
      n.flashcards.forEach(c => {
        total++;
        if (c.reviews > 0) reviewed++;
        if (c.difficulty === 'easy') easy++;
      });
    });
    return { total, reviewed, easy };
  }

  /* --- PLANNER / EVENTS METHODS --- */
  getEvents() {
    return this.state.events;
  }

  createEvent(title, date, notebookAssoc, type) {
    const newEvent = {
      id: 'event-' + Date.now(),
      title: title || 'Sin Nombre',
      date: date || new Date().toISOString().split('T')[0],
      notebookAssoc: notebookAssoc || '',
      type: type || 'assignment', // 'assignment', 'exam', 'reading', 'other'
      completed: false
    };
    this.state.events.push(newEvent);
    this.saveState();
    return newEvent;
  }

  toggleEventCompleted(id) {
    const event = this.state.events.find(e => e.id === id);
    if (event) {
      event.completed = !event.completed;
      this.saveState();
    }
  }

  deleteEvent(id) {
    this.state.events = this.state.events.filter(e => e.id !== id);
    this.saveState();
  }

  /* --- APP VIEW STATE --- */
  getActiveTab() {
    return this.state.activeTab;
  }

  setActiveTab(tabName) {
    this.state.activeTab = tabName;
    this.saveState();
  }

  getActiveNotebookId() {
    return this.state.activeNotebookId;
  }

  setActiveNotebookId(id) {
    this.state.activeNotebookId = id;
    this.saveState();
  }
}

// Global state instance
const stateManager = new StateManager();
window.stateManager = stateManager; // Make accessible to components

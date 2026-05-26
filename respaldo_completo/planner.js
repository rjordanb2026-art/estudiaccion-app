/* ==========================================================================
   ESTUDIACCIÓN (KILONOTION) - CALENDARIO Y PLANIFICADOR DE ENTREGAS
   ========================================================================== */

class CozyPlanner {
  constructor() {
    this.currentDate = new Date();
    this.currentFilter = 'all';

    // DOM Elements
    this.calendarDays = document.getElementById('calendar-days');
    this.monthYearLabel = document.getElementById('calendar-month-year');
    this.btnPrevMonth = document.getElementById('btn-prev-month');
    this.btnNextMonth = document.getElementById('btn-next-month');
    this.tasksListContainer = document.getElementById('planner-tasks-list');
    this.notebookAssocSelect = document.getElementById('event-notebook-assoc');

    this.initEvents();
  }

  initEvents() {
    if (!this.btnPrevMonth) return;

    // Month Navigation
    this.btnPrevMonth.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.renderPlanner();
    });

    this.btnNextMonth.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.renderPlanner();
    });

    // Task Filter Chips
    const filters = document.querySelectorAll('.filter-chip');
    filters.forEach(chip => {
      chip.addEventListener('click', (e) => {
        filters.forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilter = e.target.dataset.filter;
        this.renderTasksList();
      });
    });
  }

  // Populate notebooks select in Add Event modal
  populateNotebooksDropdown() {
    if (!this.notebookAssocSelect) return;
    this.notebookAssocSelect.innerHTML = '<option value="">Sin vincular (General)</option>';
    const notebooks = stateManager.getNotebooks();
    notebooks.forEach(n => {
      const option = document.createElement('option');
      option.value = n.id;
      option.innerText = n.title;
      this.notebookAssocSelect.appendChild(option);
    });
  }

  // Render both Calendar grid and tasks checklist
  renderPlanner() {
    this.renderCalendar();
    this.renderTasksList();
    this.populateNotebooksDropdown();
  }

  renderCalendar() {
    if (!this.calendarDays) return;
    this.calendarDays.innerHTML = '';

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    // Set month-year title
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    this.monthYearLabel.innerText = `${monthNames[month]} ${year}`;

    // Get calendar days math
    const firstDayIndex = new Date(year, month, 1).getDay(); // Day of week (0-6)
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    const today = new Date();
    const events = stateManager.getEvents();

    // 1. Render previous month's padding days
    for (let i = firstDayIndex; i > 0; i--) {
      const dayNum = prevMonthTotalDays - i + 1;
      const dayBox = this.createDayBox(dayNum, true, null);
      this.calendarDays.appendChild(dayBox);
    }

    // 2. Render current month days
    for (let day = 1; day <= totalDays; day++) {
      const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
      
      // Filter events on this specific date
      const dateString = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.date === dateString);

      const dayBox = this.createDayBox(day, false, isToday, dayEvents);
      this.calendarDays.appendChild(dayBox);
    }

    // 3. Render next month's padding days
    const totalRendered = firstDayIndex + totalDays;
    const remainingDays = 42 - totalRendered; // 6 rows grid
    for (let day = 1; day <= remainingDays; day++) {
      const dayBox = this.createDayBox(day, true, null);
      this.calendarDays.appendChild(dayBox);
    }
  }

  createDayBox(dayNum, isOutside, isToday, dayEvents = []) {
    const box = document.createElement('div');
    box.className = 'calendar-day-box';
    if (isOutside) box.classList.add('outside');
    if (isToday) box.classList.add('today');

    // Day number
    const numSpan = document.createElement('span');
    numSpan.className = 'day-number';
    numSpan.innerText = dayNum;
    box.appendChild(numSpan);

    // Event pills list
    const eventsDiv = document.createElement('div');
    eventsDiv.className = 'day-events';

    dayEvents.forEach(event => {
      const pill = document.createElement('span');
      pill.className = 'day-event-pill';
      pill.innerText = event.title;
      
      // Color coding based on notebooks
      if (event.notebookAssoc) {
        const notebook = stateManager.getNotebook(event.notebookAssoc);
        if (notebook) {
          pill.style.backgroundColor = notebook.coverColor;
          // Calculate readable text color
          pill.style.color = '#4A3E3D';
        }
      } else {
        pill.style.backgroundColor = '#E5B299';
        pill.style.color = 'white';
      }

      // Striking text if completed
      if (event.completed) {
        pill.style.textDecoration = 'line-through';
        pill.style.opacity = '0.5';
      }

      eventsDiv.appendChild(pill);
    });

    box.appendChild(eventsDiv);
    return box;
  }

  renderTasksList() {
    if (!this.tasksListContainer) return;
    this.tasksListContainer.innerHTML = '';

    let events = stateManager.getEvents();

    // Sort by date ascending
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Filter list
    if (this.currentFilter === 'pending') {
      events = events.filter(e => !e.completed);
    } else if (this.currentFilter === 'completed') {
      events = events.filter(e => e.completed);
    }

    if (events.length === 0) {
      this.tasksListContainer.innerHTML = `
        <div class="sidebar-card-item" style="text-align: center; color: var(--color-text-muted);">
          No hay tareas en esta categoría. ✨
        </div>
      `;
      return;
    }

    events.forEach(e => {
      const item = document.createElement('div');
      item.className = 'task-item';
      if (e.completed) item.classList.add('completed');

      // Associate notebook name
      let assocTag = '';
      let borderLeftColor = 'var(--color-accent)';
      if (e.notebookAssoc) {
        const notebook = stateManager.getNotebook(e.notebookAssoc);
        if (notebook) {
          assocTag = `<span class="notebook-subject-tag" style="background-color: ${notebook.coverColor}; font-size: 0.65rem; margin-top: 0;">${notebook.title}</span>`;
          borderLeftColor = notebook.coverColor;
        }
      }

      item.style.borderLeft = `5px solid ${borderLeftColor}`;

      // Format date nicely
      const dateParts = e.date.split('-');
      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : e.date;

      item.innerHTML = `
        <div class="task-left">
          <label class="task-checkbox-wrapper">
            <input type="checkbox" class="task-checkbox" ${e.completed ? 'checked' : ''} data-id="${e.id}">
          </label>
          <div>
            <div class="task-title">${e.title}</div>
            <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
              ${assocTag}
              <span class="task-date-badge"><i class="fa-regular fa-calendar"></i> ${formattedDate}</span>
            </div>
          </div>
        </div>
        <div class="task-meta">
          <button class="btn-task-delete" data-id="${e.id}" title="Eliminar Tarea">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;

      // Event Listeners for completion toggle
      const checkbox = item.querySelector('.task-checkbox');
      checkbox.addEventListener('change', () => {
        stateManager.toggleEventCompleted(e.id);
        this.renderPlanner();
      });

      // Delete listener
      const deleteBtn = item.querySelector('.btn-task-delete');
      deleteBtn.addEventListener('click', () => {
        if (confirm('¿Eliminar esta entrega/tarea?')) {
          stateManager.deleteEvent(e.id);
          this.renderPlanner();
        }
      });

      this.tasksListContainer.appendChild(item);
    });
  }
}

// Instantiate globally
window.addEventListener('DOMContentLoaded', () => {
  window.cozyPlanner = new CozyPlanner();
});

/**
 * Task Tracker — Client Application Controller
 * Pure Vanilla JavaScript (Zero External Dependencies)
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = 'spd_task_tracker_items';

  const state = {
    tasks: [],
    filter: 'all', // 'all' | 'pending' | 'completed'
    isApiAvailable: false,
  };

  // Default seed tasks if local storage is empty
  const DEFAULT_TASKS = [
    { id: '1', title: 'Initialize project directory & scaffolding', completed: true, createdAt: Date.now() - 3600000 },
    { id: '2', title: 'Verify background monitoring engine debounce', completed: false, createdAt: Date.now() - 1800000 },
    { id: '3', title: 'Review semantic changelog and milestone push', completed: false, createdAt: Date.now() },
  ];

  // ---------------------------------------------------------------------------
  // DOM Cache
  // ---------------------------------------------------------------------------
  const DOM = {
    form: document.getElementById('task-form'),
    input: document.getElementById('task-input'),
    list: document.getElementById('task-list'),
    emptyState: document.getElementById('empty-state'),
    emptyDescription: document.getElementById('empty-description'),
    filterButtons: document.querySelectorAll('.filter-btn'),
    clearCompletedBtn: document.getElementById('clear-completed-btn'),
    syncStatus: document.getElementById('sync-status'),
    syncLabel: document.getElementById('sync-label'),
    badgeAll: document.getElementById('badge-all'),
    badgePending: document.getElementById('badge-pending'),
    badgeCompleted: document.getElementById('badge-completed'),
    statsText: document.getElementById('stats-text'),
    progressBar: document.getElementById('progress-bar'),
    progressPercent: document.getElementById('progress-percent'),
  };

  // ---------------------------------------------------------------------------
  // Storage & API Layer
  // ---------------------------------------------------------------------------

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('Failed to read tasks from localStorage:', err);
    }
    return DEFAULT_TASKS;
  }

  function saveToLocalStorage(tasks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.warn('Failed to save tasks to localStorage:', err);
    }
  }

  async function syncWithServer(tasks) {
    if (!state.isApiAvailable) return;
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tasks),
      });
    } catch (err) {
      console.warn('API sync failed:', err);
    }
  }

  async function initializeData() {
    // 1. Load from localStorage first for immediate render
    state.tasks = loadFromLocalStorage();
    render();

    // 2. Check for backend API availability
    try {
      const res = await fetch('/api/tasks', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        state.isApiAvailable = true;
        updateSyncBadge(true);
        if (Array.isArray(data) && data.length > 0) {
          state.tasks = data;
          saveToLocalStorage(data);
          render();
        } else if (state.tasks.length > 0) {
          // Sync local tasks up to server
          await syncWithServer(state.tasks);
        }
      } else {
        updateSyncBadge(false);
      }
    } catch (err) {
      state.isApiAvailable = false;
      updateSyncBadge(false);
    }
  }

  function updateSyncBadge(isApi) {
    if (isApi) {
      DOM.syncStatus.classList.remove('offline');
      DOM.syncLabel.textContent = 'API Synced';
      DOM.syncStatus.title = 'Connected to Python Backend (/api/tasks)';
    } else {
      DOM.syncStatus.classList.add('offline');
      DOM.syncLabel.textContent = 'Local Storage';
      DOM.syncStatus.title = 'Offline mode: changes saved in browser localStorage';
    }
  }

  function persist() {
    saveToLocalStorage(state.tasks);
    syncWithServer(state.tasks);
    render();
  }

  // ---------------------------------------------------------------------------
  // Task Operations
  // ---------------------------------------------------------------------------

  function addTask(title) {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const newTask = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      title: cleanTitle,
      completed: false,
      createdAt: Date.now(),
    };

    state.tasks.unshift(newTask);
    persist();
  }

  function toggleTask(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (task) {
      task.completed = !task.completed;
      persist();
    }
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    persist();
  }

  function clearCompleted() {
    state.tasks = state.tasks.filter((t) => !t.completed);
    persist();
  }

  function setFilter(filter) {
    state.filter = filter;
    DOM.filterButtons.forEach((btn) => {
      const isActive = btn.dataset.filter === filter;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    render();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function render() {
    const totalCount = state.tasks.length;
    const completedCount = state.tasks.filter((t) => t.completed).length;
    const pendingCount = totalCount - completedCount;

    // Update badges
    DOM.badgeAll.textContent = totalCount;
    DOM.badgePending.textContent = pendingCount;
    DOM.badgeCompleted.textContent = completedCount;

    // Update Footer Stats
    DOM.statsText.textContent = `${pendingCount} task${pendingCount === 1 ? '' : 's'} remaining`;
    const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    DOM.progressBar.style.width = `${percent}%`;
    DOM.progressPercent.textContent = `${percent}%`;

    // Filter tasks
    const filteredTasks = state.tasks.filter((task) => {
      if (state.filter === 'pending') return !task.completed;
      if (state.filter === 'completed') return task.completed;
      return true;
    });

    // Render list or empty state
    DOM.list.innerHTML = '';
    if (filteredTasks.length === 0) {
      DOM.emptyState.classList.remove('hidden');
      if (state.filter === 'pending') {
        DOM.emptyDescription.textContent = 'All caught up! No pending tasks right now.';
      } else if (state.filter === 'completed') {
        DOM.emptyDescription.textContent = 'No completed tasks yet. Finish a task to see it here!';
      } else {
        DOM.emptyDescription.textContent = 'You have no tasks. Type above and press Enter to create one!';
      }
    } else {
      DOM.emptyState.classList.add('hidden');
      filteredTasks.forEach((task) => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.dataset.id = task.id;

        li.innerHTML = `
          <div class="task-main">
            <input
              type="checkbox"
              class="task-checkbox"
              ${task.completed ? 'checked' : ''}
              aria-label="Mark task as complete"
            />
            <span class="task-title">${escapeHtml(task.title)}</span>
          </div>
          <div class="task-actions">
            <button class="action-btn delete-btn" title="Delete task" aria-label="Delete task">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        `;

        // Event: Toggle on checkbox or task click
        const checkbox = li.querySelector('.task-checkbox');
        const main = li.querySelector('.task-main');

        checkbox.addEventListener('change', (e) => {
          e.stopPropagation();
          toggleTask(task.id);
        });

        main.addEventListener('click', (e) => {
          if (e.target !== checkbox) {
            toggleTask(task.id);
          }
        });

        // Event: Delete
        const deleteBtn = li.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteTask(task.id);
        });

        DOM.list.appendChild(li);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Event Listeners
  // ---------------------------------------------------------------------------

  function setupEvents() {
    // Add task form submit
    DOM.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = DOM.input.value;
      if (val.trim()) {
        addTask(val);
        DOM.input.value = '';
        DOM.input.focus();
      }
    });

    // Filter tabs
    DOM.filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        setFilter(btn.dataset.filter);
      });
    });

    // Clear completed
    DOM.clearCompletedBtn.addEventListener('click', () => {
      clearCompleted();
    });

    // Keyboard shortcuts: Escape to clear input
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.activeElement === DOM.input) {
        DOM.input.value = '';
        DOM.input.blur();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // App Boot
  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    initializeData();
  });
})();

/**
 * Developer Task & Workflow Manager — Client Controller (Phase 1)
 * Zero external dependencies. Pure vanilla JavaScript.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Configuration & State
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = 'dev_task_workflow_items';
  const API_ENDPOINT = '/api/tasks';

  const state = {
    tasks: [],
    filter: 'all', // 'all' | 'pending' | 'completed'
    isOnline: false,
    syncInProgress: false,
  };

  // Seed tasks fallback if both localStorage and backend are empty
  const SEED_TASKS = [
    {
      id: 'task-seed-1',
      title: 'Architect REST API routes',
      description: 'Design zero-dependency endpoints in server.py with atomic persistence and graceful port fallback.',
      priority: 'High',
      tags: ['backend', 'api'],
      completed: true,
      createdAt: Date.now() - 3600000 * 2,
    },
    {
      id: 'task-seed-2',
      title: 'Build dark theme dashboard layout',
      description: 'Implement slate/zinc color palette with responsive flex/grid cards and custom scrollbars.',
      priority: 'Medium',
      tags: ['frontend', 'ui'],
      completed: true,
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'task-seed-3',
      title: 'Implement dual-mode local & server synchronization',
      description: 'Ensure resilient state failover between localStorage and backend fetch requests with real-time status indicators.',
      priority: 'High',
      tags: ['frontend', 'architecture'],
      completed: false,
      createdAt: Date.now() - 1800000,
    },
    {
      id: 'task-seed-4',
      title: 'Add keyboard navigation & accessibility',
      description: 'Support Enter to submit and Escape to dismiss input fields with clear ARIA labels and focus rings.',
      priority: 'Low',
      tags: ['accessibility', 'ux'],
      completed: false,
      createdAt: Date.now(),
    },
  ];

  // ---------------------------------------------------------------------------
  // DOM Cache
  // ---------------------------------------------------------------------------
  const DOM = {
    form: document.getElementById('task-form'),
    titleInput: document.getElementById('task-title'),
    descInput: document.getElementById('task-desc'),
    prioritySelect: document.getElementById('task-priority'),
    priorityDot: document.getElementById('priority-dot-indicator'),
    tagsInput: document.getElementById('task-tags'),
    clearFormBtn: document.getElementById('clear-form-btn'),
    taskGrid: document.getElementById('task-grid'),
    emptyState: document.getElementById('empty-state'),
    emptyTitle: document.getElementById('empty-title'),
    emptySubtitle: document.getElementById('empty-subtitle'),
    filterTabs: document.querySelectorAll('.tab-btn'),
    clearCompletedBtn: document.getElementById('clear-completed-btn'),
    syncIndicator: document.getElementById('sync-indicator'),
    statusPulse: document.getElementById('status-pulse'),
    statusText: document.getElementById('status-text'),
    badgeAll: document.getElementById('badge-all'),
    badgePending: document.getElementById('badge-pending'),
    badgeCompleted: document.getElementById('badge-completed'),
    statusSummary: document.getElementById('status-summary'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    progressLabel: document.getElementById('progress-label'),
  };

  // ---------------------------------------------------------------------------
  // Data Sanitization & Tag Utilities
  // ---------------------------------------------------------------------------

  function sanitizeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function parseTags(rawInput) {
    if (!rawInput) return [];
    return rawInput
      .split(/[, ]+/)
      .map((tag) => tag.trim().toLowerCase().replace(/^#/, ''))
      .filter((tag) => tag.length > 0 && /^[a-z0-9_-]+$/i.test(tag));
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    const d = new Date(timestamp);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  }

  // ---------------------------------------------------------------------------
  // Dual-Persistence Layer (Local Storage & REST API)
  // ---------------------------------------------------------------------------

  function loadLocalTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[Storage] Failed to read from localStorage:', err);
    }
    return SEED_TASKS;
  }

  function saveLocalTasks(tasks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.warn('[Storage] Failed to write to localStorage:', err);
    }
  }

  function updateSyncStatus(isOnline) {
    state.isOnline = isOnline;
    if (isOnline) {
      DOM.syncIndicator.classList.remove('offline');
      DOM.statusText.textContent = 'Server Synced';
      DOM.syncIndicator.title = 'Live sync connected with Python REST backend';
    } else {
      DOM.syncIndicator.classList.add('offline');
      DOM.statusText.textContent = 'Offline Cache';
      DOM.syncIndicator.title = 'Offline mode: changes securely stored in browser localStorage';
    }
  }

  async function syncToServer(tasks) {
    state.syncInProgress = true;
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tasks),
      });

      if (response.ok) {
        updateSyncStatus(true);
      } else {
        updateSyncStatus(false);
      }
    } catch (err) {
      updateSyncStatus(false);
    } finally {
      state.syncInProgress = false;
    }
  }

  async function initializeStorage() {
    // 1. Immediate optimistic render from local storage
    state.tasks = loadLocalTasks();
    render();

    // 2. Fetch ground-truth tasks from backend API
    try {
      const response = await fetch(API_ENDPOINT, { method: 'GET' });
      if (response.ok) {
        const serverTasks = await response.json();
        updateSyncStatus(true);
        if (Array.isArray(serverTasks) && serverTasks.length > 0) {
          state.tasks = serverTasks;
          saveLocalTasks(serverTasks);
          render();
        } else if (state.tasks.length > 0) {
          // Push initial local seed tasks up to backend
          await syncToServer(state.tasks);
        }
      } else {
        updateSyncStatus(false);
      }
    } catch (err) {
      updateSyncStatus(false);
    }
  }

  function commitState() {
    saveLocalTasks(state.tasks);
    syncToServer(state.tasks);
    render();
  }

  // ---------------------------------------------------------------------------
  // Task Operations
  // ---------------------------------------------------------------------------

  function createTask(title, description, priority, rawTags) {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const newTask = {
      id: 'task-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      title: cleanTitle,
      description: description.trim(),
      priority: priority || 'Medium',
      tags: parseTags(rawTags),
      completed: false,
      createdAt: Date.now(),
    };

    state.tasks.unshift(newTask);
    commitState();
  }

  function toggleTaskCompletion(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (task) {
      task.completed = !task.completed;
      commitState();
    }
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    commitState();
  }

  function clearCompletedTasks() {
    state.tasks = state.tasks.filter((t) => !t.completed);
    commitState();
  }

  function setFilter(filter) {
    state.filter = filter;
    DOM.filterTabs.forEach((tab) => {
      const isActive = tab.dataset.filter === filter;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    render();
  }

  // ---------------------------------------------------------------------------
  // Priority Indicator
  // ---------------------------------------------------------------------------

  function updatePriorityIndicator() {
    const val = (DOM.prioritySelect.value || 'Medium').toLowerCase();
    DOM.priorityDot.className = 'priority-dot';
    if (val === 'low') {
      DOM.priorityDot.classList.add('dot-low');
    } else if (val === 'high') {
      DOM.priorityDot.classList.add('dot-high');
    } else {
      DOM.priorityDot.classList.add('dot-medium');
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function render() {
    const totalCount = state.tasks.length;
    const completedCount = state.tasks.filter((t) => t.completed).length;
    const pendingCount = totalCount - completedCount;

    // Update filter count badges
    DOM.badgeAll.textContent = totalCount;
    DOM.badgePending.textContent = pendingCount;
    DOM.badgeCompleted.textContent = completedCount;

    // Update Footer Summary & Progress
    DOM.statusSummary.textContent = `${pendingCount} task${pendingCount === 1 ? '' : 's'} remaining`;
    const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    DOM.progressBarFill.style.width = `${percent}%`;
    DOM.progressLabel.textContent = `${percent}%`;

    // Filter tasks based on active tab
    const filteredTasks = state.tasks.filter((task) => {
      if (state.filter === 'pending') return !task.completed;
      if (state.filter === 'completed') return task.completed;
      return true;
    });

    // Render cards or empty state
    DOM.taskGrid.innerHTML = '';
    if (filteredTasks.length === 0) {
      DOM.emptyState.classList.remove('hidden');
      if (state.filter === 'pending') {
        DOM.emptyTitle.textContent = 'All caught up!';
        DOM.emptySubtitle.textContent = 'No pending tasks left in this sprint. Create a new task or take a break!';
      } else if (state.filter === 'completed') {
        DOM.emptyTitle.textContent = 'No completed tasks yet';
        DOM.emptySubtitle.textContent = 'Complete pending tasks to track milestone achievements here.';
      } else {
        DOM.emptyTitle.textContent = 'No tasks in workspace';
        DOM.emptySubtitle.textContent = 'Your task list is empty. Add a task using the creation form above.';
      }
    } else {
      DOM.emptyState.classList.add('hidden');
      filteredTasks.forEach((task) => {
        const card = document.createElement('article');
        card.className = `task-card ${task.completed ? 'completed' : ''}`;
        card.dataset.id = task.id;

        const priorityLower = (task.priority || 'medium').toLowerCase();
        const pillClass = `pill-${priorityLower}`;

        let tagsHtml = '';
        if (Array.isArray(task.tags) && task.tags.length > 0) {
          tagsHtml = `
            <div class="task-tags">
              ${task.tags.map((tag) => `<span class="tag-badge">#${sanitizeHtml(tag)}</span>`).join('')}
            </div>
          `;
        }

        let descHtml = '';
        if (task.description && task.description.trim()) {
          descHtml = `<div class="task-body">${sanitizeHtml(task.description)}</div>`;
        }

        card.innerHTML = `
          <div class="task-header">
            <div class="task-title-group" role="button" tabindex="0" aria-label="Toggle task status">
              <input
                type="checkbox"
                class="task-checkbox"
                ${task.completed ? 'checked' : ''}
                aria-label="Mark task as complete"
              />
              <h3 class="task-title">${sanitizeHtml(task.title)}</h3>
            </div>
            <div class="task-actions">
              <span class="priority-pill ${pillClass}">${sanitizeHtml(task.priority || 'Medium')}</span>
              <button type="button" class="btn-icon-action delete-btn" title="Delete task" aria-label="Delete task">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          </div>
          ${descHtml}
          <div class="task-footer">
            ${tagsHtml}
            <span class="task-time">${formatRelativeTime(task.createdAt)}</span>
          </div>
        `;

        // Event: Checkbox & Title group click to toggle
        const checkbox = card.querySelector('.task-checkbox');
        const titleGroup = card.querySelector('.task-title-group');

        checkbox.addEventListener('change', (e) => {
          e.stopPropagation();
          toggleTaskCompletion(task.id);
        });

        titleGroup.addEventListener('click', (e) => {
          if (e.target !== checkbox) {
            toggleTaskCompletion(task.id);
          }
        });

        titleGroup.addEventListener('keydown', (e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggleTaskCompletion(task.id);
          }
        });

        // Event: Delete task
        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteTask(task.id);
        });

        DOM.taskGrid.appendChild(card);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Event Listeners & Keyboard Accessibility
  // ---------------------------------------------------------------------------

  function setupEvents() {
    // Form submission
    DOM.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = DOM.titleInput.value;
      const desc = DOM.descInput.value;
      const priority = DOM.prioritySelect.value;
      const tags = DOM.tagsInput.value;

      if (title.trim()) {
        createTask(title, desc, priority, tags);
        DOM.form.reset();
        updatePriorityIndicator();
        DOM.titleInput.focus();
      }
    });

    // Priority selector indicator updates
    DOM.prioritySelect.addEventListener('change', updatePriorityIndicator);

    // Clear form button
    DOM.clearFormBtn.addEventListener('click', () => {
      DOM.form.reset();
      updatePriorityIndicator();
      DOM.titleInput.focus();
    });

    // Filter tab buttons
    DOM.filterTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        setFilter(tab.dataset.filter);
      });
    });

    // Clear completed button
    DOM.clearCompletedBtn.addEventListener('click', () => {
      clearCompletedTasks();
    });

    // Keyboard accessibility: Escape clears form inputs; Ctrl+Enter submits from textarea
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (document.activeElement === DOM.titleInput || document.activeElement === DOM.descInput || document.activeElement === DOM.tagsInput) {
          DOM.form.reset();
          updatePriorityIndicator();
          document.activeElement.blur();
        }
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        if (document.activeElement === DOM.descInput) {
          DOM.form.requestSubmit();
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Bootstrap Application
  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    updatePriorityIndicator();
    initializeStorage();
  });
})();

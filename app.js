/**
 * Task Tracker — Client Application Controller (Phase 2 Enhanced)
 * Pure Vanilla JavaScript (Zero External Dependencies)
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = 'spd_task_tracker_items';
  const ANALYTICS_KEY = 'task_tracker_analytics_expanded';

  const state = {
    tasks: [],
    filter: 'all', // 'all' | 'pending' | 'completed'
    priorityFilter: 'all', // 'all' | 'high' | 'medium' | 'low'
    tagFilter: 'all', // 'all' | <tag_name>
    isApiAvailable: false,
    analyticsExpanded: true,
  };

  // Default seed tasks with Phase 2 attributes for turnkey onboarding
  const DEFAULT_TASKS = [
    {
      id: 'seed-1',
      title: 'Configure background monitoring engine',
      completed: true,
      priority: 'medium',
      dueDate: '2026-09-22',
      tags: ['monitoring', 'backend'],
      createdAt: 1727140000000,
    },
    {
      id: 'seed-2',
      title: 'Build lightweight Task Tracker frontend and API',
      completed: true,
      priority: 'low',
      dueDate: '2026-09-23',
      tags: ['frontend', 'api'],
      createdAt: 1727142000000,
    },
    {
      id: 'seed-3',
      title: 'Verify file debounce, diff calculation, and shadow git',
      completed: false,
      priority: 'high',
      dueDate: '2026-09-26',
      tags: ['testing', 'urgent'],
      createdAt: 1727143500000,
    },
    {
      id: 'seed-4',
      title: 'Audit security headers and token expiration',
      completed: false,
      priority: 'high',
      dueDate: '2026-09-21',
      tags: ['security', 'urgent'],
      createdAt: 1727144000000,
    },
    {
      id: 'seed-5',
      title: 'Publish API documentation and user guide',
      completed: false,
      priority: 'medium',
      dueDate: '2026-09-28',
      tags: ['work', 'docs'],
      createdAt: 1727144500000,
    },
  ];

  // ---------------------------------------------------------------------------
  // DOM Cache
  // ---------------------------------------------------------------------------
  const DOM = {
    form: document.getElementById('task-form'),
    input: document.getElementById('task-input'),
    prioritySelect: document.getElementById('task-priority'),
    priorityIndicator: document.getElementById('priority-color-indicator'),
    dueDateInput: document.getElementById('task-due-date'),
    tagsInput: document.getElementById('task-tags-input'),
    list: document.getElementById('task-list'),
    emptyState: document.getElementById('empty-state'),
    emptyDescription: document.getElementById('empty-description'),
    filterButtons: document.querySelectorAll('.filter-btn'),
    clearCompletedBtn: document.getElementById('clear-completed-btn'),
    exportBackupBtn: document.getElementById('export-backup-btn'),
    syncStatus: document.getElementById('sync-status'),
    syncLabel: document.getElementById('sync-label'),
    badgeAll: document.getElementById('badge-all'),
    badgePending: document.getElementById('badge-pending'),
    badgeCompleted: document.getElementById('badge-completed'),
    statsText: document.getElementById('stats-text'),
    progressBar: document.getElementById('progress-bar'),
    progressPercent: document.getElementById('progress-percent'),

    // Analytics Drawer Elements
    analyticsDrawer: document.getElementById('analytics-drawer'),
    analyticsToggleBtn: document.getElementById('analytics-toggle-btn'),
    analyticsPreviewText: document.getElementById('analytics-preview-text'),
    analyticsCompletionRate: document.getElementById('analytics-completion-rate'),
    analyticsCompletionRatio: document.getElementById('analytics-completion-ratio'),
    analyticsProgressBar: document.getElementById('analytics-progress-bar'),
    analyticsHighPendingCount: document.getElementById('analytics-high-pending-count'),
    analyticsHighPendingLabel: document.getElementById('analytics-high-pending-label'),
    analyticsOverdueCount: document.getElementById('analytics-overdue-count'),
    analyticsOverdueLabel: document.getElementById('analytics-overdue-label'),
    overdueIconWrap: document.getElementById('overdue-icon-wrap'),
    overdueBanner: document.getElementById('overdue-banner'),
    overdueBannerText: document.getElementById('overdue-banner-text'),

    // Filter Chips
    priorityChips: document.getElementById('priority-chips'),
    tagChips: document.getElementById('tag-chips'),
  };

  // ---------------------------------------------------------------------------
  // Data Normalization (Backwards Compatibility)
  // ---------------------------------------------------------------------------

  function normalizeTask(task) {
    if (!task || typeof task !== 'object') return null;
    return {
      id: String(task.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 4)),
      title: String(task.title || '').trim(),
      completed: Boolean(task.completed),
      priority: ['low', 'medium', 'high'].includes(String(task.priority || '').toLowerCase())
        ? String(task.priority).toLowerCase()
        : 'medium',
      dueDate: typeof task.dueDate === 'string' ? task.dueDate.trim() : '',
      tags: Array.isArray(task.tags)
        ? task.tags.map((t) => String(t).trim().toLowerCase().replace(/^#/, '')).filter(Boolean)
        : [],
      createdAt: typeof task.createdAt === 'number' ? task.createdAt : Date.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // Storage & API Layer
  // ---------------------------------------------------------------------------

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeTask).filter(Boolean);
        }
      }
    } catch (err) {
      console.warn('Failed to read tasks from localStorage:', err);
    }
    return DEFAULT_TASKS.map(normalizeTask);
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
    // 1. Load from localStorage for instantaneous UI rendering
    state.tasks = loadFromLocalStorage();
    render();

    // 2. Fetch fresh tasks from REST API
    try {
      const res = await fetch('/api/tasks', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        state.isApiAvailable = true;
        updateSyncBadge(true);
        if (Array.isArray(data) && data.length > 0) {
          state.tasks = data.map(normalizeTask).filter(Boolean);
          saveToLocalStorage(state.tasks);
          render();
        } else if (state.tasks.length > 0) {
          // Push initial local dataset to server
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
  // Date & Overdue Calculation Helpers
  // ---------------------------------------------------------------------------

  function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function isTaskOverdue(task) {
    if (task.completed || !task.dueDate) return false;
    return task.dueDate < getTodayString();
  }

  function formatDueDate(dueDate, isCompleted) {
    if (!dueDate) return null;
    const parts = dueDate.split('-');
    if (parts.length !== 3) return null;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const targetDate = new Date(year, month, day);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatted = `${monthNames[month]} ${day}`;

    if (!isCompleted && diffDays < 0) {
      return {
        label: `Overdue: ${formatted}`,
        className: 'badge-due-overdue',
        isOverdue: true,
      };
    } else if (!isCompleted && diffDays === 0) {
      return {
        label: 'Due Today',
        className: 'badge-due-today',
        isOverdue: false,
      };
    } else if (!isCompleted && diffDays === 1) {
      return {
        label: 'Due Tomorrow',
        className: 'badge-due-normal',
        isOverdue: false,
      };
    } else {
      return {
        label: `Due ${formatted}`,
        className: 'badge-due-normal',
        isOverdue: false,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Tags Extraction
  // ---------------------------------------------------------------------------

  function extractTags(tagInputString, taskTitleString) {
    const tagsSet = new Set();

    // 1. From dedicated tag input
    if (tagInputString) {
      tagInputString
        .split(/[, ]+/)
        .map((t) => t.trim().toLowerCase().replace(/^#/, ''))
        .filter(Boolean)
        .forEach((t) => tagsSet.add(t));
    }

    // 2. From hashtags typed directly in title (e.g. #work #urgent)
    if (taskTitleString) {
      const hashMatches = taskTitleString.match(/#([a-zA-Z0-9_\-]+)/g);
      if (hashMatches) {
        hashMatches.forEach((m) => {
          const clean = m.toLowerCase().replace(/^#/, '');
          if (clean) tagsSet.add(clean);
        });
      }
    }

    return Array.from(tagsSet);
  }

  // ---------------------------------------------------------------------------
  // Task Operations
  // ---------------------------------------------------------------------------

  function addTask(title, priority, dueDate, rawTags) {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const tags = extractTags(rawTags, cleanTitle);

    const newTask = normalizeTask({
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      title: cleanTitle,
      completed: false,
      priority: priority || 'medium',
      dueDate: dueDate || '',
      tags: tags,
      createdAt: Date.now(),
    });

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

  function setStatusFilter(filter) {
    state.filter = filter;
    DOM.filterButtons.forEach((btn) => {
      const isActive = btn.dataset.filter === filter;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    render();
  }

  function setPriorityFilter(priority) {
    state.priorityFilter = priority;
    DOM.priorityChips.querySelectorAll('.chip').forEach((chip) => {
      const isActive = chip.dataset.priority === priority;
      chip.classList.toggle('active', isActive);
    });
    render();
  }

  function setTagFilter(tag) {
    state.tagFilter = tag;
    DOM.tagChips.querySelectorAll('.chip').forEach((chip) => {
      const isActive = chip.dataset.tag === tag;
      chip.classList.toggle('active', isActive);
    });
    render();
  }

  // ---------------------------------------------------------------------------
  // Analytics Summary Drawer
  // ---------------------------------------------------------------------------

  function toggleAnalytics(forceState) {
    const shouldExpand = forceState !== undefined ? forceState : !state.analyticsExpanded;
    state.analyticsExpanded = shouldExpand;
    DOM.analyticsDrawer.classList.toggle('collapsed', !shouldExpand);
    DOM.analyticsToggleBtn.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
    try {
      localStorage.setItem(ANALYTICS_KEY, shouldExpand ? 'true' : 'false');
    } catch (_) {}
  }

  function initAnalyticsDrawer() {
    try {
      const saved = localStorage.getItem(ANALYTICS_KEY);
      if (saved === 'false') {
        toggleAnalytics(false);
      }
    } catch (_) {}
  }

  function updateAnalytics(totalCount, completedCount) {
    const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    DOM.analyticsCompletionRate.textContent = `${percent}%`;
    DOM.analyticsCompletionRatio.textContent = `${completedCount} of ${totalCount} completed`;
    DOM.analyticsProgressBar.style.width = `${percent}%`;

    // High priority pending
    const highPending = state.tasks.filter(
      (t) => !t.completed && (t.priority || 'medium') === 'high'
    ).length;
    DOM.analyticsHighPendingCount.textContent = highPending;
    DOM.analyticsHighPendingLabel.textContent =
      highPending === 0
        ? 'All high-priority tasks completed'
        : `${highPending} task${highPending === 1 ? '' : 's'} require immediate focus`;

    // Overdue task alerts
    const overdueTasks = state.tasks.filter(isTaskOverdue);
    const overdueCount = overdueTasks.length;
    DOM.analyticsOverdueCount.textContent = overdueCount;

    if (overdueCount > 0) {
      DOM.analyticsOverdueLabel.textContent = `${overdueCount} task${overdueCount === 1 ? '' : 's'} past deadline`;
      DOM.analyticsOverdueCount.classList.add('color-rose');
      DOM.overdueIconWrap.className = 'metric-icon-wrap icon-rose';
      DOM.overdueBanner.classList.remove('hidden');
      DOM.overdueBannerText.textContent = `Attention: You have ${overdueCount} overdue task${
        overdueCount === 1 ? '' : 's'
      } requiring immediate action!`;
    } else {
      DOM.analyticsOverdueLabel.textContent = 'No overdue tasks';
      DOM.analyticsOverdueCount.classList.remove('color-rose');
      DOM.overdueIconWrap.className = 'metric-icon-wrap icon-neutral';
      DOM.overdueBanner.classList.add('hidden');
    }

    // Header Quick Summary
    DOM.analyticsPreviewText.textContent = `${percent}% completed • ${highPending} high priority • ${overdueCount} overdue`;
  }

  // ---------------------------------------------------------------------------
  // Dynamic Tag Filter Chips
  // ---------------------------------------------------------------------------

  function renderTagChips() {
    const allTags = new Set();
    state.tasks.forEach((t) => {
      (t.tags || []).forEach((tag) => allTags.add(tag));
    });

    const tagsArray = Array.from(allTags).sort();

    // If active tag filter no longer exists in tasks, reset to 'all'
    if (state.tagFilter !== 'all' && !allTags.has(state.tagFilter)) {
      state.tagFilter = 'all';
    }

    DOM.tagChips.innerHTML = '';

    // "All Tags" chip
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `chip ${state.tagFilter === 'all' ? 'active' : ''}`;
    allBtn.dataset.tag = 'all';
    allBtn.textContent = 'All Tags';
    allBtn.addEventListener('click', () => setTagFilter('all'));
    DOM.tagChips.appendChild(allBtn);

    // Specific tag chips
    tagsArray.forEach((tag) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chip ${state.tagFilter === tag ? 'active' : ''}`;
      btn.dataset.tag = tag;
      btn.textContent = `#${tag}`;
      btn.addEventListener('click', () => setTagFilter(tag));
      DOM.tagChips.appendChild(btn);
    });
  }

  // ---------------------------------------------------------------------------
  // Export Handler
  // ---------------------------------------------------------------------------

  function handleExportBackup() {
    if (state.isApiAvailable) {
      // Trigger native download from Python REST backend
      window.location.href = '/api/tasks/export';
    } else {
      // Resilient client-side fallback
      const payload = JSON.stringify(state.tasks, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks-backup-${getTodayString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
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

    // Update status badges
    DOM.badgeAll.textContent = totalCount;
    DOM.badgePending.textContent = pendingCount;
    DOM.badgeCompleted.textContent = completedCount;

    // Update footer stats
    DOM.statsText.textContent = `${pendingCount} task${pendingCount === 1 ? '' : 's'} remaining`;
    const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    DOM.progressBar.style.width = `${percent}%`;
    DOM.progressPercent.textContent = `${percent}%`;

    // Update Analytics Drawer
    updateAnalytics(totalCount, completedCount);

    // Update Tag Filter Chips
    renderTagChips();

    // Multi-faceted filtering: Status + Priority + Category Tag
    const filteredTasks = state.tasks.filter((task) => {
      // 1. Status Filter
      if (state.filter === 'pending' && task.completed) return false;
      if (state.filter === 'completed' && !task.completed) return false;

      // 2. Priority Filter
      if (state.priorityFilter !== 'all' && task.priority !== state.priorityFilter) {
        return false;
      }

      // 3. Category Tag Filter
      if (state.tagFilter !== 'all' && !(task.tags || []).includes(state.tagFilter)) {
        return false;
      }

      return true;
    });

    // Render task items or empty state
    DOM.list.innerHTML = '';
    if (filteredTasks.length === 0) {
      DOM.emptyState.classList.remove('hidden');
      if (state.filter === 'pending') {
        DOM.emptyDescription.textContent = 'All caught up! No pending tasks matching your filters.';
      } else if (state.filter === 'completed') {
        DOM.emptyDescription.textContent = 'No completed tasks yet for this filter criteria.';
      } else if (state.priorityFilter !== 'all' || state.tagFilter !== 'all') {
        DOM.emptyDescription.textContent = 'No tasks found matching your active priority or tag filter.';
      } else {
        DOM.emptyDescription.textContent = 'You have no tasks. Add one above to get started!';
      }
    } else {
      DOM.emptyState.classList.add('hidden');
      filteredTasks.forEach((task) => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.dataset.id = task.id;

        // Due date badge
        const dueInfo = formatDueDate(task.dueDate, task.completed);
        let dueBadgeHtml = '';
        if (dueInfo) {
          dueBadgeHtml = `
            <span class="badge-due ${dueInfo.className}" title="Due: ${task.dueDate}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              ${escapeHtml(dueInfo.label)}
            </span>
          `;
        }

        // Tags badges
        let tagsHtml = '';
        if (Array.isArray(task.tags) && task.tags.length > 0) {
          tagsHtml = task.tags
            .map(
              (tag) => `
              <span class="badge-tag" data-tag="${escapeHtml(tag)}" title="Filter by #${escapeHtml(tag)}">
                #${escapeHtml(tag)}
              </span>
            `
            )
            .join('');
        }

        // Priority badge
        const pClass = `badge-${task.priority || 'medium'}`;
        const pLabel = (task.priority || 'medium').toUpperCase();

        li.innerHTML = `
          <div class="task-main">
            <input
              type="checkbox"
              class="task-checkbox"
              ${task.completed ? 'checked' : ''}
              aria-label="Mark task as complete"
            />
            <div class="task-content">
              <span class="task-title">${escapeHtml(task.title)}</span>
              <div class="task-badges">
                <span class="badge-priority ${pClass}">
                  <span class="priority-dot"></span>
                  ${pLabel}
                </span>
                ${dueBadgeHtml}
                ${tagsHtml}
              </div>
            </div>
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

        // Event: Checkbox / Main row click
        const checkbox = li.querySelector('.task-checkbox');
        const main = li.querySelector('.task-main');

        checkbox.addEventListener('change', (e) => {
          e.stopPropagation();
          toggleTask(task.id);
        });

        main.addEventListener('click', (e) => {
          // If clicked on tag badge, set filter instead of toggling task
          const tagPill = e.target.closest('.badge-tag');
          if (tagPill) {
            e.stopPropagation();
            setTagFilter(tagPill.dataset.tag);
            return;
          }
          if (e.target !== checkbox) {
            toggleTask(task.id);
          }
        });

        // Event: Delete task
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
  // Priority Indicator Updates
  // ---------------------------------------------------------------------------

  function updatePriorityIndicator(val) {
    DOM.priorityIndicator.className = 'meta-indicator';
    if (val === 'low') {
      DOM.priorityIndicator.classList.add('indicator-emerald');
    } else if (val === 'high') {
      DOM.priorityIndicator.classList.add('indicator-rose');
    } else {
      DOM.priorityIndicator.classList.add('indicator-amber');
    }
  }

  // ---------------------------------------------------------------------------
  // Event Listeners
  // ---------------------------------------------------------------------------

  function setupEvents() {
    // Add Task submit
    DOM.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = DOM.input.value;
      const priority = DOM.prioritySelect.value;
      const dueDate = DOM.dueDateInput.value;
      const rawTags = DOM.tagsInput.value;

      if (title.trim()) {
        addTask(title, priority, dueDate, rawTags);
        DOM.input.value = '';
        DOM.tagsInput.value = '';
        DOM.dueDateInput.value = '';
        DOM.input.focus();
      }
    });

    // Priority selector change updates color indicator
    DOM.prioritySelect.addEventListener('change', (e) => {
      updatePriorityIndicator(e.target.value);
    });

    // Status filter tabs
    DOM.filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        setStatusFilter(btn.dataset.filter);
      });
    });

    // Priority filter chips
    DOM.priorityChips.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        setPriorityFilter(chip.dataset.priority);
      });
    });

    // Clear completed tasks
    DOM.clearCompletedBtn.addEventListener('click', () => {
      clearCompleted();
    });

    // Export backup
    DOM.exportBackupBtn.addEventListener('click', () => {
      handleExportBackup();
    });

    // Analytics Drawer toggle
    DOM.analyticsToggleBtn.addEventListener('click', () => {
      toggleAnalytics();
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.activeElement === DOM.input) {
        DOM.input.value = '';
        DOM.input.blur();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Application Bootstrap
  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initAnalyticsDrawer();
    setupEvents();
    updatePriorityIndicator(DOM.prioritySelect.value);
    initializeData();
  });
})();

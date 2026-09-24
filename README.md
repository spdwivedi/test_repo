# Developer Task & Workflow Manager (Phase 1)

A clean, responsive, and lightweight developer task management application built with pure vanilla web technologies and a zero-dependency Python HTTP/REST backend.

---

## Overview & Key Features

- **Semantic HTML5 & Accessible UI**: Clean application header with a live synchronization status pill (**Server Synced** vs. **Offline Cache**), keyboard-friendly task creation form, and responsive card container.
- **Slate/Zinc Dark Theme**: Professional dark aesthetic crafted around `#0b0f19` (background), `#131b2e` (card surfaces), and `#1e293b` (borders).
- **Priority Accent System**: High-visibility status pills with distinct color identities:
  - **Low Priority**: Emerald (`#10b981`)
  - **Medium Priority**: Amber (`#f59e0b`)
  - **High Priority**: Rose (`#f43f5e`)
- **Category Tagging**: Seamless tag assignment (`#frontend`, `#backend`, `#bug`) for sprint categorization.
- **Dynamic Filter Toolbar**: "All", "Pending", and "Completed" tabs featuring live count badges and a bulk "Clear Completed" action.
- **Dual-Persistence Pattern**:
  - Immediate optimistic saves to browser `localStorage` ensuring instant UI responsiveness.
  - Asynchronous background synchronization with the Python REST API.
  - Automatic fallback to offline storage when disconnected from the backend.
- **Zero-Dependency Python Backend**: Multi-threaded HTTP server utilizing only the Python standard library, featuring atomic file writes and graceful port auto-fallback.

---

## Project Structure

```text
.
├── index.html       # Semantic HTML5 layout, task form, filter toolbar, & empty state
├── style.css        # Slate/zinc theme, priority pills, micro-interactions, scrollbars
├── app.js           # Client-side state manager, dual-persistence, & keyboard shortcuts
├── server.py        # Python ThreadingHTTPServer with atomic tasks.json persistence
├── tasks.json       # JSON file datastore pre-seeded with initial sprint tasks
└── README.md        # Comprehensive project documentation and API reference
```

---

## Quick Start & Local Startup

### Prerequisites
- Python 3.8+ (No external packages or `pip install` required)
- Any modern web browser (Chrome, Edge, Firefox, Safari)

### Starting the Application Server

Run the server from the project root directory:

```bash
python server.py
```

By default, the server attempts to bind to port `5000`. If port `5000` is already in use by another application, it gracefully steps through ports `5001`, `5002`, ..., up to 10 fallback attempts.

You can also specify a custom host or port:

```bash
python server.py --host 127.0.0.1 --port 8080
```

### Accessing the Web Application

Open your browser and navigate to:
```text
http://127.0.0.1:5000
```
*(or the port printed in your terminal)*

---

## REST API Reference

The server exposes standard JSON endpoints with full CORS headers enabled (`Access-Control-Allow-Origin: *`).

### 1. `GET /api/tasks`
Retrieves the full list of task items.

- **Request**: `GET http://127.0.0.1:5000/api/tasks`
- **Response** (`200 OK`):
  ```json
  [
    {
      "id": "task-seed-1",
      "title": "Architect REST API routes",
      "description": "Design zero-dependency endpoints in server.py...",
      "priority": "High",
      "tags": ["backend", "api"],
      "completed": true,
      "createdAt": 1727220000000
    }
  ]
  ```

### 2. `POST /api/tasks`
Saves and overwrites or appends tasks atomically using a temporary swap file to prevent corrupted writes.

- **Request**: `POST http://127.0.0.1:5000/api/tasks`
- **Headers**: `Content-Type: application/json`
- **Payload (Full List Replacement)**:
  ```json
  [
    {
      "id": "task-1",
      "title": "Implement authentication refresh tokens",
      "description": "Rotate refresh tokens securely on each grant.",
      "priority": "High",
      "tags": ["auth", "security"],
      "completed": false,
      "createdAt": 1727230000000
    }
  ]
  ```
- **Response** (`200 OK`):
  ```json
  {
    "status": "saved",
    "count": 1
  }
  ```

---

## Keyboard Shortcuts & Usability

- <kbd>Enter</kbd> (in Task Title): Submits and creates the task immediately.
- <kbd>Ctrl</kbd> + <kbd>Enter</kbd> / <kbd>Cmd</kbd> + <kbd>Enter</kbd> (in Description): Submits the task form directly from the multiline textarea.
- <kbd>Escape</kbd>: Clears form inputs and dismisses focus.
- <kbd>Space</kbd> / <kbd>Enter</kbd> on task title group: Toggles completion state for screen reader and keyboard accessibility.

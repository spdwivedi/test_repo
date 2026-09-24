#!/usr/bin/env python3
"""
server.py
=========
Developer Task & Workflow Manager — HTTP Server & REST API (Phase 1)
Zero external dependencies. Pure standard library Python 3.

Features:
- Serves static assets (index.html, style.css, app.js, tasks.json).
- Provides JSON REST endpoints:
    GET  /api/tasks -> Returns current task list from tasks.json
    POST /api/tasks -> Validates and atomically persists task list
- Graceful port fallback starting at port 5000.
- Full CORS header support for seamless client integration.
"""

from __future__ import annotations

import argparse
import json
import logging
import mimetypes
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("TaskServer")

WORKSPACE_DIR = Path(__file__).resolve().parent
DATA_FILE = WORKSPACE_DIR / "tasks.json"

DEFAULT_SEED_TASKS: list[dict[str, Any]] = [
    {
        "id": "task-seed-1",
        "title": "Architect REST API routes",
        "description": "Design zero-dependency endpoints in server.py with atomic persistence and graceful port fallback.",
        "priority": "High",
        "tags": ["backend", "api"],
        "completed": True,
        "createdAt": 1727220000000,
    },
    {
        "id": "task-seed-2",
        "title": "Build dark theme dashboard layout",
        "description": "Implement slate/zinc color palette with responsive flex/grid cards and custom scrollbars.",
        "priority": "Medium",
        "tags": ["frontend", "ui"],
        "completed": True,
        "createdAt": 1727223600000,
    },
    {
        "id": "task-seed-3",
        "title": "Implement dual-mode local & server synchronization",
        "description": "Ensure resilient state failover between localStorage and backend fetch requests with real-time status indicators.",
        "priority": "High",
        "tags": ["frontend", "architecture"],
        "completed": False,
        "createdAt": 1727227200000,
    },
    {
        "id": "task-seed-4",
        "title": "Add keyboard navigation & accessibility",
        "description": "Support Enter to submit and Escape to dismiss input fields with clear ARIA labels and focus rings.",
        "priority": "Low",
        "tags": ["accessibility", "ux"],
        "completed": False,
        "createdAt": 1727230800000,
    },
]


def load_tasks() -> list[dict[str, Any]]:
    """Load tasks from tasks.json, falling back to default seeds if missing or invalid."""
    if DATA_FILE.exists():
        try:
            content = DATA_FILE.read_text(encoding="utf-8")
            data = json.loads(content)
            if isinstance(data, list):
                return data
            logger.warning("%s did not contain a JSON list; using defaults.", DATA_FILE)
        except Exception as exc:
            logger.warning("Error reading %s: %s; falling back to seeds.", DATA_FILE, exc)
    return DEFAULT_SEED_TASKS


def save_tasks_atomically(tasks: list[dict[str, Any]]) -> None:
    """Atomically write tasks list to tasks.json using a temporary swap file."""
    temp_file = DATA_FILE.with_suffix(".tmp")
    payload = json.dumps(tasks, indent=2).encode("utf-8")
    try:
        temp_file.write_bytes(payload)
        temp_file.replace(DATA_FILE)
        logger.info("Successfully persisted %d tasks to %s", len(tasks), DATA_FILE.name)
    except Exception as exc:
        if temp_file.exists():
            try:
                temp_file.unlink()
            except OSError:
                pass
        logger.error("Atomic persistence failed for %s: %s", DATA_FILE, exc)
        raise exc


class TaskRequestHandler(BaseHTTPRequestHandler):
    """HTTP request handler supporting CORS, JSON REST endpoints, and static files."""

    def log_message(self, format: str, *args: Any) -> None:
        logger.info("%s - %s", self.address_string(), format % args)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, data: Any, status: int = 200) -> None:
        payload = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self._send_cors_headers()
        self.end_headers()
        try:
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _send_error_json(self, message: str, status: int = 400) -> None:
        self._send_json({"error": message, "status": "error"}, status=status)

    # ------------------------------------------------------------------
    # GET Handlers
    # ------------------------------------------------------------------

    def do_GET(self) -> None:
        parsed_url = urlparse(self.path)
        url_path = parsed_url.path.rstrip("/")
        if not url_path:
            url_path = "/"

        # API: GET /api/tasks
        if url_path == "/api/tasks":
            tasks = load_tasks()
            self._send_json(tasks)
            return

        # Static File Delivery
        self._serve_static(url_path)

    # ------------------------------------------------------------------
    # POST Handlers
    # ------------------------------------------------------------------

    def do_POST(self) -> None:
        parsed_url = urlparse(self.path)
        url_path = parsed_url.path.rstrip("/")

        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            self._send_error_json("Payload cannot be empty", status=400)
            return

        try:
            raw_body = self.rfile.read(content_length).decode("utf-8")
            body = json.loads(raw_body)
        except Exception as exc:
            self._send_error_json(f"Malformed JSON body: {exc}", status=400)
            return

        # API: POST /api/tasks
        if url_path == "/api/tasks":
            if isinstance(body, list):
                # Validate array elements
                for item in body:
                    if not isinstance(item, dict) or "title" not in item:
                        self._send_error_json("Every task item must be an object with a 'title'", status=400)
                        return
                save_tasks_atomically(body)
                self._send_json({"status": "saved", "count": len(body)})
            elif isinstance(body, dict):
                # Single task prepend
                if "title" not in body or not str(body["title"]).strip():
                    self._send_error_json("Task must contain a non-empty 'title'", status=400)
                    return
                tasks = load_tasks()
                tasks.insert(0, body)
                save_tasks_atomically(tasks)
                self._send_json({"status": "added", "task": body})
            else:
                self._send_error_json("Payload must be a task list or task object", status=400)
            return

        self._send_error_json(f"Endpoint not found: {url_path}", status=404)

    # ------------------------------------------------------------------
    # Static File Delivery
    # ------------------------------------------------------------------

    def _serve_static(self, rel_path: str) -> None:
        if rel_path in ("/", ""):
            rel_path = "/index.html"

        clean_rel = rel_path.lstrip("/")
        target_file = (WORKSPACE_DIR / clean_rel).resolve()

        # Prevent directory traversal attacks
        try:
            target_file.relative_to(WORKSPACE_DIR)
        except ValueError:
            self._send_error_json("Access denied", status=403)
            return

        if not target_file.exists() or not target_file.is_file():
            self._send_error_json(f"File not found: {clean_rel}", status=404)
            return

        mime_type, _ = mimetypes.guess_type(str(target_file))
        if not mime_type:
            mime_type = "application/octet-stream"

        # Ensure correct text/encoding headers
        if "text" in mime_type or "javascript" in mime_type or "json" in mime_type:
            content_type = f"{mime_type}; charset=utf-8"
        else:
            content_type = mime_type

        try:
            content = target_file.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(content)
        except Exception as exc:
            logger.error("Error serving static file %s: %s", target_file, exc)
            self._send_error_json(f"Internal server error: {exc}", status=500)


def run_server(host: str = "127.0.0.1", start_port: int = 5000, max_attempts: int = 10) -> None:
    """Start ThreadingHTTPServer with auto-port fallback if port is already bound."""
    current_port = start_port
    server: ThreadingHTTPServer | None = None

    for _ in range(max_attempts):
        try:
            server = ThreadingHTTPServer((host, current_port), TaskRequestHandler)
            break
        except OSError:
            logger.warning("Port %d is occupied; trying %d...", current_port, current_port + 1)
            current_port += 1

    if server is None:
        logger.error("Could not bind server to any port between %d and %d", start_port, start_port + max_attempts - 1)
        sys.exit(1)

    url = f"http://{host}:{current_port}"
    print("\n" + "=" * 65)
    print(f"  Developer Task & Workflow Manager Server running at:")
    print(f"  --> {url}")
    print(f"  Static Root: {WORKSPACE_DIR}")
    print(f"  Data Store:  {DATA_FILE}")
    print("=" * 65)
    print("  Press Ctrl+C to terminate the server.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        server.server_close()
        logger.info("Server gracefully terminated.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Developer Task & Workflow Manager HTTP Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=5000, help="Initial port (default: 5000)")
    args = parser.parse_args()

    run_server(host=args.host, start_port=args.port)

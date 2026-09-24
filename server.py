#!/usr/bin/env python3
"""
server.py
=========
Zero-dependency lightweight HTTP server and REST API for Task Tracker.

Features:
- Serves static assets (index.html, style.css, app.js).
- Provides JSON REST endpoints:
    GET  /api/tasks  -> Returns current task list
    POST /api/tasks  -> Replaces/saves task list
- Local file persistence in tasks.json.
- Threading HTTP server with graceful port selection.
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
from urllib.parse import parse_qs, urlparse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("TaskTrackerServer")

WORKSPACE_DIR = Path(__file__).resolve().parent
DATA_FILE = WORKSPACE_DIR / "tasks.json"

DEFAULT_TASKS = [
    {
        "id": "seed-1",
        "title": "Configure background monitoring engine",
        "completed": True,
        "priority": "medium",
        "dueDate": "2026-09-23",
        "tags": ["monitoring", "backend"],
        "createdAt": 1727140000000,
    },
    {
        "id": "seed-2",
        "title": "Build lightweight Task Tracker frontend and API",
        "completed": True,
        "priority": "low",
        "dueDate": "2026-09-24",
        "tags": ["frontend", "api"],
        "createdAt": 1727142000000,
    },
    {
        "id": "seed-3",
        "title": "Verify file debounce, diff calculation, and shadow git",
        "completed": False,
        "priority": "high",
        "dueDate": "2026-09-26",
        "tags": ["testing", "urgent"],
        "createdAt": 1727143500000,
    },
]


def load_tasks() -> list[dict[str, Any]]:
    """Load tasks from tasks.json, falling back to default tasks if missing."""
    if DATA_FILE.exists():
        try:
            return json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Failed to parse %s: %s; using default tasks.", DATA_FILE, exc)
    return DEFAULT_TASKS


def save_tasks(tasks: list[dict[str, Any]]) -> None:
    """Save tasks to tasks.json."""
    try:
        DATA_FILE.write_text(json.dumps(tasks, indent=2), encoding="utf-8")
        logger.info("Saved %d tasks to %s", len(tasks), DATA_FILE.name)
    except Exception as exc:
        logger.error("Failed to write to %s: %s", DATA_FILE, exc)
        raise


class TaskRequestHandler(BaseHTTPRequestHandler):
    """Custom HTTP handler with CORS, JSON REST routing, and static file serving."""

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
        self.send_header("Access-Control-Expose-Headers", "Content-Disposition")

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

        # API: /api/tasks/export -> Downloadable JSON backup
        if url_path == "/api/tasks/export":
            tasks = load_tasks()
            payload = json.dumps(tasks, indent=2).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="tasks-backup.json"')
            self.send_header("Content-Length", str(len(payload)))
            self._send_cors_headers()
            self.end_headers()
            try:
                self.wfile.write(payload)
            except (BrokenPipeError, ConnectionResetError):
                pass
            return

        # API: /api/tasks (supports optional query filters: ?priority=high&tag=work)
        if url_path == "/api/tasks":
            tasks = load_tasks()
            query_params = parse_qs(parsed_url.query)

            # Optional filter: priority (low, medium, high)
            if "priority" in query_params:
                p_filter = query_params["priority"][0].strip().lower()
                if p_filter and p_filter != "all":
                    tasks = [
                        t for t in tasks
                        if str(t.get("priority", "medium")).strip().lower() == p_filter
                    ]

            # Optional filter: tag (e.g. work, urgent, #work)
            if "tag" in query_params:
                raw_tag = query_params["tag"][0].strip().lower().lstrip("#")
                if raw_tag and raw_tag != "all":
                    tasks = [
                        t for t in tasks
                        if any(
                            str(tg).strip().lower().lstrip("#") == raw_tag
                            for tg in t.get("tags", [])
                        )
                    ]

            # Optional filter: status (pending, completed, all)
            if "status" in query_params:
                s_filter = query_params["status"][0].strip().lower()
                if s_filter == "completed":
                    tasks = [t for t in tasks if t.get("completed", False)]
                elif s_filter == "pending":
                    tasks = [t for t in tasks if not t.get("completed", False)]

            self._send_json(tasks)
            return

        # Static File Serving
        self._handle_static(url_path)

    # ------------------------------------------------------------------
    # POST Handlers
    # ------------------------------------------------------------------

    def do_POST(self) -> None:
        url_path = self.path.split("?")[0].rstrip("/")

        content_len = int(self.headers.get("Content-Length", 0))
        if content_len <= 0:
            self._send_error_json("Empty request payload", status=400)
            return

        try:
            raw_body = self.rfile.read(content_len).decode("utf-8")
            body = json.loads(raw_body)
        except Exception as exc:
            self._send_error_json(f"Invalid JSON body: {exc}", status=400)
            return

        # API: /api/tasks
        if url_path == "/api/tasks":
            if isinstance(body, list):
                save_tasks(body)
                self._send_json({"status": "saved", "count": len(body)})
            elif isinstance(body, dict):
                # Single task addition
                tasks = load_tasks()
                tasks.insert(0, body)
                save_tasks(tasks)
                self._send_json({"status": "added", "task": body})
            else:
                self._send_error_json("Payload must be a task list or task object", status=400)
            return

        self._send_error_json(f"Endpoint not found: {url_path}", status=404)

    # ------------------------------------------------------------------
    # Static File Serving
    # ------------------------------------------------------------------

    def _handle_static(self, rel_path: str) -> None:
        if rel_path in ("/", ""):
            rel_path = "/index.html"

        # Sanitize path to prevent directory traversal
        clean_rel = rel_path.lstrip("/")
        target_file = (WORKSPACE_DIR / clean_rel).resolve()

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

        try:
            content = target_file.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", f"{mime_type}; charset=utf-8" if "text" in mime_type or "javascript" in mime_type or "json" in mime_type else mime_type)
            self.send_header("Content-Length", str(len(content)))
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(content)
        except Exception as exc:
            logger.error("Error serving %s: %s", target_file, exc)
            self._send_error_json(f"Internal server error: {exc}", status=500)


def run_server(host: str = "127.0.0.1", port: int = 5000) -> None:
    """Start ThreadingHTTPServer with auto-port fallback if port is occupied."""
    current_port = port
    server: ThreadingHTTPServer | None = None

    for _ in range(10):
        try:
            server = ThreadingHTTPServer((host, current_port), TaskRequestHandler)
            break
        except OSError:
            logger.warning("Port %d busy; trying %d...", current_port, current_port + 1)
            current_port += 1

    if server is None:
        logger.error("Could not bind server to any port near %d", port)
        sys.exit(1)

    url = f"http://{host}:{current_port}"
    print("\n" + "=" * 60)
    print(f"  Task Tracker Server is running at: {url}")
    print(f"  Static Directory: {WORKSPACE_DIR}")
    print(f"  Data File:        {DATA_FILE}")
    print("=" * 60)
    print("Press Ctrl+C to stop the server.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        server.server_close()
        logger.info("Server stopped.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Task Tracker HTTP Server & API")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=5000, help="Port to listen on (default: 5000)")
    args = parser.parse_args()

    run_server(host=args.host, port=args.port)

/**
 * Disposable fixture sources used by pythonRuntimeProbe.
 * Kept separate so the probe module stays focused on host detection/evidence.
 */

export const FIXTURE_MAIN = `"""AppForge python-runtime probe fixture (stdlib only)."""
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def greet(name: str = "AppForge") -> str:
    return f"hello-{name}"


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        if self.path not in ("/", "/health", "/health/live"):
            self.send_response(404)
            self.end_headers()
            return
        body = json.dumps(
            {"ok": True, "runtime": "python", "message": greet()}
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return


def serve(host: str = "127.0.0.1", port: int = 8000) -> None:
    server = ThreadingHTTPServer((host, port), HealthHandler)
    server.handle_request()


if __name__ == "__main__":
    print(greet("probe"), flush=True)
`;

export const FIXTURE_TEST = `"""Unittest coverage for the python-runtime probe fixture."""
from __future__ import annotations

import unittest

from app.main import greet


class FixtureTests(unittest.TestCase):
    def test_greet(self) -> None:
        self.assertEqual(greet("probe"), "hello-probe")


if __name__ == "__main__":
    unittest.main()
`;

export const HEALTH_CHECK_SCRIPT = `"""In-process health check for the probe fixture service."""
from __future__ import annotations

import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from app.main import HealthHandler


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 0), HealthHandler)
    host, port = server.server_address
    ready = threading.Event()

    def run() -> None:
        ready.set()
        server.handle_request()

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    if not ready.wait(5):
        raise SystemExit("server thread failed to start")

    url = f"http://{host}:{port}/health"
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            body = response.read().decode("utf-8")
            payload = {
                "ok": True,
                "status": response.status,
                "body": body,
                "url": url,
            }
    except urllib.error.URLError as exc:
        payload = {"ok": False, "error": str(exc), "url": url}

    thread.join(timeout=5)
    server.server_close()
    print(json.dumps(payload), flush=True)
    raise SystemExit(0 if payload.get("ok") else 1)


if __name__ == "__main__":
    main()
`;

export const LOCAL_PKG_INIT = `VERSION = "0.0.1"
`;

export const LOCAL_PYPROJECT = `[build-system]
requires = ["setuptools>=61"]
build-backend = "setuptools.build_meta"

[project]
name = "appforge-python-probe-pkg"
version = "0.0.1"

[tool.setuptools.packages.find]
include = ["appforge_python_probe_pkg*"]
`;

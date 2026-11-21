#!/usr/bin/env python3
"""
Agente de smoke/market testing em loop.
Por padrão é somente leitura. Para testes de mutação, use TEST_MUTATIONS=1
apenas em uma base/ambiente de teste.
"""
import json
import os
import time
import urllib.error
import urllib.request

BASE_URL = os.environ.get("BASE_URL", "https://site-de-ingles.onrender.com").rstrip("/")
ITERATIONS = int(os.environ.get("ITERATIONS", "10"))
SLEEP_SECONDS = float(os.environ.get("SLEEP_SECONDS", "2"))
USERNAME = os.environ.get("TEST_USERNAME", "")
PASSWORD = os.environ.get("TEST_PASSWORD", "")
MUTATIONS = os.environ.get("TEST_MUTATIONS", "0") == "1"

def request(path, method="GET", body=None, headers=None, cookie=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE_URL + path, data=data, method=method)
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    if cookie:
        req.add_header("Cookie", cookie)
    for key, value in (headers or {}).items():
        req.add_header(key, value)
    with urllib.request.urlopen(req, timeout=15) as response:
        raw = response.read().decode()
        return response.status, response.headers, json.loads(raw) if raw else {}

def main():
    failures = 0
    cookie = None
    for iteration in range(1, ITERATIONS + 1):
        checks = []
        try:
            status, _, data = request("/api/health")
            checks.append(("health", status == 200 and data.get("ok") is True))
            for path in ("/", "/index.html", "/styles.css", "/script.js", "/teacher.js", "/teacher.css"):
                status, _, _ = request(path)
                checks.append((path, status == 200))
            if USERNAME and PASSWORD:
                status, headers, data = request("/api/auth/login", "POST", {"username": USERNAME, "password": PASSWORD})
                checks.append(("login", status == 200 and "user" in data))
                cookie = headers.get("Set-Cookie", "").split(";", 1)[0] or cookie
                for path in ("/api/auth/me", "/api/users", "/api/lessons", "/api/progress"):
                    status, _, _ = request(path, cookie=cookie)
                    checks.append((path, status == 200))
            failed = [name for name, ok in checks if not ok]
            print(f"[loop {iteration}/{ITERATIONS}] OK={len(failed)==0} falhas={failed}")
        except Exception as exc:
            failures += 1
            print(f"[loop {iteration}/{ITERATIONS}] ERRO: {exc}")
        if any(not ok for _, ok in checks):
            failures += 1
        if iteration < ITERATIONS:
            time.sleep(SLEEP_SECONDS)
    raise SystemExit(1 if failures else 0)

if __name__ == "__main__":
    main()

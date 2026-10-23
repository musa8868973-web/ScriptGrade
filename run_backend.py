"""ScriptGrade - Local Backend & PostgreSQL Embedded Runner."""

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

# Avoid Windows CP1252 charmap encoding issues
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
PGDATA_DIR = ROOT_DIR / ".localstack" / "pgdata"
PORT_PG = 57324
PORT_API = 8000

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pgserver
import uvicorn

print("=" * 65)
print("  ScriptGrade - Automated Script Grading & Diagnostic Platform")
print("=" * 65)

# Discover postgres.exe from pgserver
pg_bin_dir = Path(pgserver.__file__).resolve().parent / "pginstall" / "bin"
postgres_exe = pg_bin_dir / "postgres.exe"

if not postgres_exe.exists():
    raise RuntimeError(f"PostgreSQL executable not found at: {postgres_exe}")

# Check if a TCP port is currently bound
def is_port_open(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def free_port(port: int) -> None:
    """Kill any Windows process currently holding *port* so uvicorn can bind.

    Uses `netstat -ano` + `taskkill` — no third-party packages required.
    Silently skips on non-Windows or if the port is already free.
    """
    if not is_port_open(port):
        return
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True, timeout=5,
        )
        for line in result.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.split()
                pid = int(parts[-1])
                if pid == 0:
                    continue
                subprocess.run(
                    ["taskkill", "/F", "/PID", str(pid)],
                    capture_output=True, timeout=5,
                )
                print(f"      [OK] Freed port {port} (killed PID {pid})")
                time.sleep(0.5)
                break
    except Exception as exc:  # noqa: BLE001
        print(f"      [WARN] Could not free port {port}: {exc}")

pg_process = None
if not is_port_open(PORT_PG):
    print(f"[1/3] Starting embedded PostgreSQL on port {PORT_PG}...")
    pg_process = subprocess.Popen(
        [
            str(postgres_exe),
            "-D",
            str(PGDATA_DIR),
            "-p",
            str(PORT_PG),
            "-h",
            "127.0.0.1",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    # Wait for postgres to be ready
    ready = False
    for _ in range(30):
        if is_port_open(PORT_PG):
            ready = True
            break
        time.sleep(0.3)
    if not ready:
        raise RuntimeError("Timed out waiting for PostgreSQL to start.")
    time.sleep(1.5)  # Allow database recovery / startup to complete cleanly
    print(f"      [OK] PostgreSQL listening on 127.0.0.1:{PORT_PG}")
else:
    print(f"[1/3] PostgreSQL already active on port {PORT_PG}")

db_url = f"postgresql+asyncpg://postgres:@127.0.0.1:{PORT_PG}/scriptgrade"
os.environ["DATABASE_URL"] = db_url

try:
    # 2. Print info
    print("[2/3] Backend Gateway Services:")
    print("      * API Gateway: http://localhost:8000")
    print("      * OpenAPI Docs: http://localhost:8000/docs")
    print("      * Health Check: http://localhost:8000/health")
    print("      * Demo Account: demo@scriptgrade.pk / HackathonDemo2026")
    print("=" * 65)
    print(f"[3/3] Starting Uvicorn server on http://127.0.0.1:{PORT_API}...")
    print("=" * 65)
    # Free the API port first — a stale previous session may still hold it,
    # which causes [Errno 10048] on Windows and a silent startup failure.
    free_port(PORT_API)

    # 3. Start uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=PORT_API, log_level="info")
finally:
    if pg_process is not None and pg_process.poll() is None:
        print("\n[Shutdown] Stopping local PostgreSQL cluster...")
        pg_process.terminate()
        try:
            pg_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pg_process.kill()
        print("[Shutdown] Completed cleanly.")

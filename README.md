# Chemical Bottle Color Detection — Feasibility POC

Three services, run separately (no orchestration for this POC):

```
colortest/           Next.js frontend            → http://localhost:3000
colortest_backend/    NestJS API                  → http://localhost:4000/api
cv-service/           FastAPI + OpenCV analyzer   → http://localhost:8000
```

## Run (same machine only)

**1. CV service (Python)**

```bash
cd cv-service
python3.11 -m venv .venv && source .venv/bin/activate   # use 3.11 — opencv/pydantic wheels aren't on 3.14 yet
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**2. Backend (NestJS)**

```bash
cd colortest_backend
npm install
npm run start:dev
# Optional env vars: PORT (default 4000), CV_SERVICE_URL (default http://localhost:8000),
# FRONTEND_ORIGIN (comma-separated, default = allow any origin), MAX_IMAGE_SIZE_BYTES
```

**3. Frontend (Next.js)**

```bash
cd colortest
npm install
npm run dev
```

Open http://localhost:3000.

## Run so another device on the same Wi-Fi/LAN can use it

This only requires the frontend and backend to be reachable at your machine's
LAN IP instead of `localhost` — the browser on the other device talks to the
frontend and backend directly; the CV service stays localhost-only since only
the backend (on the same machine) talks to it.

1. **Find your LAN IP** (already done for you below — re-run if it changes):
   ```bash
   ipconfig getifaddr en0
   ```
   Currently: `192.168.2.40`

2. **`colortest/.env.local`** already points at that IP:
   ```
   NEXT_PUBLIC_API_URL=http://192.168.2.40:4000/api
   ```
   If your IP changes (different Wi-Fi network, DHCP renewal, etc.), update this
   file and restart `npm run dev` — Next.js inlines `NEXT_PUBLIC_*` vars into the
   browser bundle at build/compile time, so a running dev server won't pick up
   the change on its own.

3. **Start all three services as above** on the host machine. The backend
   (`main.ts`) already binds to `0.0.0.0` and allows any CORS origin (no auth
   on this POC, so that's fine for LAN testing). `next dev` also binds to all
   interfaces by default — you'll see a "Network: http://192.168.2.40:3000"
   line in its log.

4. **On the other device**, browse to `http://192.168.2.40:3000`.

5. **macOS firewall**: the first time each service binds a port, macOS may pop
   up "Do you want the application … to accept incoming network connections?"
   — click **Allow** for both Node and Python, or the other device's requests
   will silently fail to connect.

### Camera capture caveat

Browsers only allow `getUserMedia` (the "Capture From Camera" button) in a
"secure context" — `https://` or `http://localhost`. A plain `http://` LAN IP
(e.g. `http://192.168.2.40:3000`) does **not** count, so the in-browser camera
button will likely fail with a permissions/`NotAllowedError` on the other
device. This is a browser platform restriction, not a bug in this app.
Workaround for testing over LAN: use the phone's native camera app to take the
photo, then use **Choose Image** to upload it — that path works fine over
plain HTTP.

## What this is

A feasibility test for detecting the color of a liquid inside a transparent
bottle from a photo: pick a positive/negative expected color, upload or
capture a bottle image, and see the measured RGB/HSV/CIELAB values and a
CIEDE2000 Delta-E comparison — with the original vs. processed image shown
side by side so the measurement itself can be evaluated. No database, no
auth — results only exist for the current analysis.

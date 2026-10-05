# Dispatch

A Django and React trip planner for property-carrying drivers. Enter a current location, pickup, delivery, and used cycle hours to generate a road route, a duty timeline, and printable daily log sheets.

## Run locally

Requires Python 3.12+ and Node.js 22+.

Backend:

```sh
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
DEBUG=true .venv/bin/python manage.py runserver 127.0.0.1:8000
```

Frontend, in another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Vite proxies local API requests to port 8000. No API keys or database setup are required. Internet access is needed for road routing, address lookup, and map tiles.

## Verify

```sh
cd backend
DEBUG=true .venv/bin/python manage.py test planner.tests
```

```sh
cd frontend
npm test
npm run build
```

## Use

Choose one of the three sample trips or search for locations in the contiguous United States. Select a search result for each location, enter cycle hours (0–70), and generate the plan. Trip settings contain departure time, terminal time zone, and optional log details. Select an itinerary event to inspect its reason and map location. The daily logs tab shows each day; Download logs exports all sheets as a vector PDF. Browser printing is also supported.

The planning guide in the app explains the supported HOS rules and assumptions. Outputs are planned logs, not signed records of actual duty. Scheduled 10-hour rests and 34-hour restarts use sleeper-berth status; shorter breaks use off-duty status. A 34-hour restart is used when the aggregate cycle balance prevents further driving. Historical recaps, truck restrictions, verified stopping facilities, and daylight-saving transition days are not supported. Public providers may be unavailable; the application reports provider failures instead of substituting fabricated routes.

## Hosted configuration

The frontend is configured for Vercel with `frontend` as its root directory. Set `VITE_API_BASE_URL` to the Render service URL followed by `/api`.

`render.yaml` configures the Django service on Render's free plan. Set `CORS_ALLOWED_ORIGINS` to the exact Vercel production origin (no trailing slash). Render generates `SECRET_KEY` and supplies its hostname. The API uses one worker with four threads. Free services can take about a minute to wake after inactivity; the UI allows for this.

Both deployments must be created from the owner's private GitHub repository. Environment examples list supported settings; do not commit real credentials. Address search and road routing endpoints can be changed through backend environment variables. The frontend tile URL can be changed with `VITE_TILE_URL` (retain the correct provider attribution when changing providers).

## Data sources

- [FMCSA hours-of-service summary](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations)
- [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- [Photon](https://github.com/komoot/photon) for address search
- [OSRM](https://project-osrm.org/) for road routing

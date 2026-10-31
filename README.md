# The Block

The buyer side of a wholesale vehicle auction platform, built for the OPENLANE coding challenge. The original brief is in [CHALLENGE.md](CHALLENGE.md).

> **Status: all three tiers (P0, P1, and P2) are built.** The app was built in priority tiers, with a review after each tier. See [§3.1 of the design](author-dev-docs/system-design-final-draft.md#31-priorities-and-cut-line).

## How to Run

There are three ways to run the app. Each one seeds the demo data on its first start.

| | Bare metal | Docker | Docker Compose |
|---|---|---|---|
| **Needs** | Node.js 24 LTS | Docker | Docker with Compose v2 |
| **Command** | `npm install` then `npm run dev` | `docker build` then `docker run` | `docker compose up --build` |
| **Open** | http://localhost:4200 | http://localhost:3000 | http://localhost:3000 |
| **Demo data** | `server/data/the-block.db` | Volume `the-block-data` | Volume `the-block_the-block-data` |

### Bare metal (Node.js, no Docker)

**Requirements:** Node.js 24 LTS and npm. Angular 22 also supports Node `^22.22.3` and `>=26`. Nothing is compiled during the install, because `better-sqlite3` ships prebuilt binaries.

**Development mode,** with live reload:

```bash
npm install
npm run dev
```

Then open **http://localhost:4200**. `npm run dev` starts three processes:

- the Angular dev server at http://localhost:4200, which forwards `/api` requests to the API server;
- the API server at http://localhost:3000;
- a watcher that rebuilds the shared API contracts.

**Production mode** is the same setup the container runs: one Node.js process serves the API and the built app on one port.

```bash
npm ci
npm run build
NODE_ENV=production npm start             # macOS, Linux, Git Bash
```

```powershell
$env:NODE_ENV = 'production'; npm start   # Windows PowerShell
```

Then open **http://localhost:3000**.

### Docker

**Requirements:** Docker Engine or Docker Desktop. Node.js does not need to be installed; the image is built inside Docker.

```bash
docker build -t the-block .
docker run --rm -p 3000:3000 -v the-block-data:/data --name the-block the-block
```

Then open **http://localhost:3000**. Notes:

- **One container** serves the API and the app, and runs as a non-root user.
- **Health.** The container reports its health from `GET /api/health`; `docker ps` shows it as *healthy* a few seconds after it starts.
- **Demo data** lives in the `the-block-data` volume, so it survives restarts. To reset it, stop the container and run `docker volume rm the-block-data`.
- **Port 3000 busy?** Map another port, for example `-p 8080:3000`, and open http://localhost:8080.

### Docker Compose

**Requirements:** Docker with the Compose v2 plugin (included in Docker Desktop).

```bash
docker compose up --build        # add -d to run it in the background
```

Then open **http://localhost:3000**. Compose builds the same image and keeps the demo data in a named volume.

| Command | What it does |
|---|---|
| `docker compose logs -f` | Follows the server logs |
| `docker compose down` | Stops the app and keeps the demo data |
| `docker compose down -v` | Stops the app and deletes the demo data, so the next start re-seeds |

### Configuration

Every setting has a working default. Set them as environment variables:

- **Bare metal:** in the shell, as shown for `NODE_ENV` above.
- **Docker:** with `-e`, for example `docker run -e SIM_BIDDER_DELAY_MS=1000-2000 …`.
- **Docker Compose:** under an `environment:` key in `docker-compose.yml`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | The port the server listens on |
| `NODE_ENV` | (unset) | `production` serves the built app and turns off the dev endpoint |
| `DB_PATH` | `server/data/the-block.db`; `/data/the-block.db` in Docker | The SQLite database file |
| `SIM_BIDDER_ENABLED` | `true` | The simulated rival bidder |
| `SIM_BIDDER_DELAY_MS` | `3000-10000` | How long the rival waits before answering a bid |
| `SIM_BIDDER_SEED` | `the-block` | Makes the rival's price limits and delays reproducible |
| `ENABLE_DEV_ENDPOINTS` | `true` outside production | Registers `POST /api/dev/vehicles/:id/simulate-bid`, which makes the rival bid at once |
| `LOG_LEVEL` | `info` | The server's log level |

### Demo data

The first start creates the database and seeds it from `data/vehicles.json`:
- Auction times are recalculated around the moment the data is seeded. At that point, about ⅛ of the auctions have ended, ⅜ are live, and ½ are upcoming. Each auction lasts 3 hours.
- If no auction is live or upcoming, the next start re-seeds automatically.
- To re-seed at any time, run `npm run db:reset` on bare metal, or delete the volume under Docker (see above). Re-seeding discards demo bids, purchases, favorites, and sign-ins.

### npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Runs the app with live reload |
| `npm test` | Runs the server unit and API integration tests, and the client unit tests (Vitest) |
| `npm run lint` | Runs ESLint, including Angular template accessibility rules |
| `npm run build` | Builds the shared contracts, the server, and a production build of the client |
| `npm run db:reset` | Re-seeds the demo data |
| `npm start` | After `npm run build`, with `NODE_ENV=production`: serves the API and the built app at http://localhost:3000, as the container does |
| `npm run e2e` | Builds, then runs the Playwright end-to-end tests against the production build, on port 3100 with fresh in-memory data |
| `npm run e2e:install` | Downloads the Chromium build that Playwright uses; run it once before the first `npm run e2e` |

## Try It

1. **Browse.** Search for something like `2023 mazda` (it finds the 2023 Mazda CX-5s), a VIN, or a lot number. Filter by make, body style, province, year, price, condition grade, title status, auction status, or Buy Now availability, and change the sort. Every search, filter, and page is in the URL, so the back button and shared links work.
2. **Open a live vehicle** and click **Bid $X**, or enter your own amount. Browsing is open to everyone, so the first bid asks you to sign in as the demo buyer. You then confirm the exact amount before the bid is submitted.
3. **After the bid,** the panel shows *You're the high bidder*, and bidding stays disabled until someone outbids you.
4. **Wait a few seconds.** A simulated rival, shown as "Another bidder", usually answers within 3 to 10 seconds. The page updates live, without a reload: the price moves, and the panel says *You've been outbid* with the new minimum. Bid again. The rival stops at a hidden limit for each vehicle, so a large enough bid always wins.
5. **Buy Now.** Turn on the *Buy Now available* filter, open a vehicle, and click **Buy now for $X**. After you confirm, the auction ends at once as your purchase.
6. **My Bids** (in the header) lists your live auctions as *Winning* or *Outbid*. Finished ones appear as *Won*, *Lost*, *Reserve not met*, or *Purchased*.
7. **Favorites.** Tap the heart on any vehicle card or vehicle page. **Favorites** in the header lists them with their current auction status.
8. **Make the rival bid on demand** (useful in a demo; not available in production mode). Copy a vehicle's ID from its URL, then run:

   ```bash
   curl -X POST -H "Content-Type: application/json" -d "{}" http://localhost:3000/api/dev/vehicles/<vehicle-id>/simulate-bid
   ```

   Every open page for that vehicle shows the new bid at once.

## Time Spent

Phase 0: ~40 minutes

Phase 1: ~2 hours 10 minutes

Phase 2: 

## Assumptions and Scope

- **This is a prototype.** It runs on the provided 200-vehicle dataset.
- **Auction times.** The dataset has start times with no timezone and no end times. They are read as UTC, re-anchored around the moment of seeding, and given a 3-hour duration.
- **Money** is whole Canadian dollars.
- **The reserve price** is never sent to the browser. Buyers only see *reserve met / not met / no reserve*.
- **Identity is demo-only.** A **Sign in** button signs you in as "Demo Buyer". Accounts, passwords, checkout, payment, and seller tools are out of scope.
- **Earlier bidding.** The dataset's bid counts and current bids are used as each auction's starting state. The individual earlier bids are unknown.

The full list of assumptions and non-goals is in the [design document](author-dev-docs/system-design-final-draft.md) (§2 and §3.2).

## Stack

- **Frontend:** Angular 22 in an RxJS-centric style (standalone components, no zone.js), Angular Material 3, and TypeScript. The theme uses OPENLANE's palette (navy, action blue, and orange and green accents) and its Poppins headings with Inter body text.
- **Backend:** Node.js 24, Express 5, and TypeScript. Request and response contracts are Zod schemas in a shared package that both the client and the server use.
- **Database:** SQLite via `better-sqlite3`, stored in a single gitignored file (or a Docker volume).
- **Live updates:** Server-Sent Events, with the browser's built-in `EventSource` wrapped in an RxJS Observable.
- **Testing:** Vitest for both the server and the client, Supertest for the API integration tests, and Playwright for the end-to-end tests.
- **Container:** one multi-stage `node:24-slim` image in which Express serves the API and the Angular build.

## What I Built (P0)

- **Inventory**
  - Free-text search: every word must match the year, make, model, trim, VIN, or lot.
  - An auction-status filter, five sort orders, and numbered pages of 24 vehicles.
  - A search bar pinned to the top of the page.
  - A filter sidebar on desktop and a filter drawer on mobile.
- **Vehicle detail**
  - Photo gallery, specifications, and condition report with damage notes.
  - A prominent warning for rebuilt and salvage titles.
  - Seller and location.
  - A countdown that uses the server's clock.
- **Bidding**
  - The server enforces the bidding rules: price-tiered increments, a minimum next bid, a $1M sanity limit, bids only while the auction is live, and no raising your own winning bid.
  - A bid is rejected if the price changed after the buyer confirmed it, and the buyer is shown the new price.
  - Every bid carries an idempotency key, so retrying a request can never place the same bid twice.
  - Errors use RFC 9457 Problem Details.
  - The UI shows nothing as accepted until the server confirms it.
- **Identity:** a header **Sign in** dialog with a cookie session. Signing in partway through a bid re-checks the auction before asking for confirmation.

## What I Built (P1)

- **The remaining filters:** make, body style, and province (choices taken from the inventory), year and price ranges, a minimum condition grade, title status, and *Buy Now available*. All filtering happens on the server, and the filter count on mobile counts each active filter once.
- **Buy Now**
  - Offered while the auction is live and bidding is below the Buy Now price.
  - A confirmation shows the price. The purchase then ends the auction in one transaction, with an idempotency key like bids.
  - Cards show a Buy Now badge.
- **My Bids:** *Active* and *Ended* tabs, each row showing your highest bid, the current or final price, a status, and the time left or end time. The Active tab refreshes every 30 seconds. The page requires sign-in, and dismissing the sign-in dialog returns you to the inventory.
- **API integration tests** for the bid, Buy Now, My Bids, and search endpoints, run against an in-memory database with a controlled clock.
- **Docker:** a single container with a healthcheck, running as a non-root user. Deep links such as `/my-bids` get the app, and unknown `/api` paths still get a JSON 404.

## What I Built (P2)

- **Live updates over Server-Sent Events.**
  - The vehicle page opens one stream for its vehicle. Every event is a complete auction snapshot built for the person watching, and the first one arrives as soon as the stream opens. A dropped connection is therefore correct again after one event.
  - Events fire when a bid is accepted, on a Buy Now purchase, and when an auction goes live or ends. A single server timer watches for the next start or end, so nothing polls.
  - The page merges the stream with its own bid responses, ignoring any older snapshot, because the two can arrive in either order. It reopens the stream when you sign in or out.
  - A comment line every 20 seconds keeps idle connections open.
- **A simulated rival bidder.**
  - It reacts to your accepted bid with one counter-bid at the minimum, 3 to 10 seconds later.
  - It bids through the same bid service as you, under the same rules and transaction.
  - It skips the counter-bid if the auction has ended, or if you were already outbid.
  - Each vehicle has a hidden ceiling, set from a fixed seed, above which it stops, so you can always win.
  - Settings, all with defaults (see [Configuration](#configuration)): `SIM_BIDDER_ENABLED`, `SIM_BIDDER_DELAY_MS`, and `SIM_BIDDER_SEED`. A dev-only endpoint makes it bid on demand.
- **The outbid moment.** When a rival takes the lead, the panel says *You've been outbid* with the amount and the new minimum, the price briefly highlights, and screen readers hear the same message. When an auction ends while you watch, its outcome replaces any earlier message.
- **Favorites.**
  - A heart on every card and vehicle page. It fills at once and reverts, with a message, if the server refuses.
  - A **Favorites** page that requires sign-in.
  - Signing in from a heart finishes saving that favorite, and the results reload quietly to show your other hearts.
  - The card's link now stretches over the whole card, so the heart can be its own button: a button nested inside a link is invalid HTML and confuses screen readers.
- **OPENLANE-inspired look.**
  - The colors were sampled from OPENLANE's public sites: a navy header, action-blue buttons and live chips, and orange and green accents.
  - Headings use Poppins and body text uses Inter.
  - Every text color pair meets WCAG AA contrast, and the ratios are noted in `styles.scss`.
  - On phones, the header's My Bids and Favorites links shrink to icons.
- **A Playwright end-to-end test suite** against the production build (`npm run e2e`).

## Notable Decisions

Each decision, with the alternatives considered and the reasoning, is in the [decision log (§5)](author-dev-docs/system-design-final-draft.md#5-decision-log). The main ones:

- **D5: The server is the source of truth for bids and time.** Whether a bid is accepted is never up to the client.
- **D18: A bid placed against a price that has since changed is rejected**, even if it still meets the new minimum. Buyers only ever commit to a price they saw.
- **D19: Idempotency keys are required** on bids and Buy Now, so retries are safe.
- **D2: Angular 22 instead of an end-of-life version,** written in the familiar RxJS style.
- **D7: SQLite.** Bid acceptance runs as one atomic transaction.
- **D3: Server-Sent Events, not WebSockets,** for live updates. Updates only flow from server to client, and SSE is plain HTTP with automatic reconnection. Bids are still ordinary `POST` requests.
- **D4: A reactive simulated bidder** that answers the buyer, with a ceiling that guarantees the buyer can win, a switch to turn it off, and a dev endpoint for demos and tests.

## Testing

- **Server: 83 unit tests.** They cover:
  - the bidding rules (including the order in which checks run), increment tiers at their boundaries, auction status at the exact start and end times, auction outcomes, Buy Now eligibility, the My Bids statuses, and the schedule mapping;
  - the simulated bidder, with fake timers and a fixed seed: the delay, every reason to skip a counter-bid, the ceiling, and cancelling when the auction ends or is bought;
  - the status timer: auctions announced exactly when they go live or end;
  - configuration parsing.
- **Server: 59 API integration tests** (Supertest, in-memory SQLite, controlled clock). They cover:
  - bids and Buy Now: 201 with the new state; 401, 400, 404, 415, and 422 errors; 409 with the latest state for a stale price, a closed auction, or a withdrawn Buy Now; a bid after a Buy Now purchase; idempotent replays, including replayed rejections, and reused keys;
  - the SSE stream, over a real connection: the first snapshot, per-viewer payloads, being outbid, status changes, keep-alives, and cleanup on disconnect;
  - favorites, My Bids, every search filter, and the dev endpoint (absent unless enabled);
  - serving the client build: caching, deep links, and the CSP.
- **Client: 118 unit tests.** Every page, component, and service has its own spec file next to it. They cover:
  - URL query parsing for every filter, the filter panel and drawer, the vehicle card and gallery, the sign-in guard, and the inventory, vehicle, My Bids, and Favorites pages;
  - the bid panel: custom-amount validation, the sign-in prompt and confirmation, Buy Now, a lost race, and being outbid over the live stream;
  - the live stream: reconnecting on sign-in, retrying with backoff, and ignoring older snapshots;
  - favorites: optimistic toggling, reverting on failure, and only the latest toggle counting.
- **End to end: 3 Playwright tests** run against the production build: search → vehicle → sign in → bid → the updated panel; a rival's bid arriving live; and saving a favorite.
- **During development,** every flow was also checked in a headless browser against both `npm run dev` and the production build. The checks covered every P1 and P2 flow, the theme colors, no sideways scrolling at 360 px, and zero console errors (so no Content-Security-Policy violations).

## What's Next

All three tiers are built. With more time, I would:

- **Run the checks in CI:** lint, unit, integration, and end-to-end tests, plus a `docker build` and a Lighthouse run against the Core Web Vitals targets (design §10).
- **Add an automated accessibility check** (axe) to the end-to-end tests, alongside the manual keyboard walkthrough.
- **Prepare for more than one server** (design §16): a client/server database, and a shared publish/subscribe layer so every instance's SSE streams see every bid.
- **Take on the bidding features left out on purpose:** proxy (maximum) bidding and anti-sniping extensions. Both need their own rules and tests (design §3.2).

## Project Layout

```text
client/           Angular app: pages/, components/, services/, core/, shared/
server/           Express API, SQLite, bidding rules, SSE, simulated bidder
shared/           API contracts (Zod schemas and types) used by both
data/             The provided vehicle dataset
e2e/              Playwright end-to-end tests (run against the production build)
author-dev-docs/  Design review, final design, and prompt examples (prompt-examples.md)
Dockerfile        One image serving the API and the app (docker-compose.yml runs it)
```

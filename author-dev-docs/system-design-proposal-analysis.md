# System Design Proposal: Architecture Review

**Document reviewed:** `author-dev-docs/system-design-baseline-doc.txt`
**Review date:** 2026-10-30
**Reviewer perspective:** Software Architect
**Context used:** the challenge brief (`README.md`), `WALKTHROUGH.md`, `SUBMISSION.md`, and the dataset in `data/vehicles.json`

**Severity legend**

- **High**: would cause incorrect behaviour, expose data, or miss a requirement reviewers will notice.
- **Medium**: a design gap or inconsistency that will cost time during implementation or be hard to defend in the walkthrough.
- **Low**: clarity, accuracy, or polish.

---

## 1. Summary

The baseline is a reasonable first pass. It restates the challenge requirements, draws an explicit scope boundary, and gives a reasoned framework choice. In its current form, though, it is mostly a stack justification plus a feature list. It says very little about how the system behaves in the one place where correctness actually matters, which is placing a bid. The parts that are specified (API, entities) are inconsistent with each other.

The challenge explicitly evaluates *judgment* and *scoping to a 3–4 hour time box*. The document never mentions the time box. The planned scope (Angular SPA, an Express API with eight endpoints, login, favorites, bid history, brand replication, Docker, Jest) is large relative to it. The most valuable revision is not to add more. It is to specify the bid flow precisely and then cut or defer whatever does not serve the minimum bar.

### Top issues

| # | Issue | Severity | Finding |
|---|---|---|---|
| 1 | Bid rules, auction lifecycle, and the "updated visible state" after a bid are unspecified | High | F13 |
| 2 | The API takes `userId` from the request body/path, so any caller can act as any user | High | F22 |
| 3 | No idempotency, concurrency control, or error contract on the bid endpoint, even though the doc plans to retry failed calls | High | F25 |
| 4 | Returning dataset Vehicle objects as-is would expose `reserve_price` to buyers | High | F13, F24 |
| 5 | Angular v16 is past end-of-life and pins the toolchain to an EOL Node.js runtime | High | F4 |
| 6 | The API is incomplete and inconsistent: duplicate bid endpoints, no endpoints to change favorites, no search or pagination | Medium | F23, F24 |
| 7 | "Scaled to thousands of vehicles per day" is asserted, but nothing in the design supports it | Medium | F1 |
| 8 | Login is both in scope (§4, §8) and out of scope (§6) | Medium | F15 |
| 9 | Scope is not reconciled with the time box: no prioritization, no cut line | Medium | §6 of this review |
| 10 | The non-functional requirements are UI details; performance, accessibility, and consistency are missing | Medium | F17 |
| 11 | Several factual inaccuracies in the stack rationale that reviewers are likely to probe | Low–Medium | F5, F6 |

---

## 2. What the document does well

- **Explicit out-of-scope list.** Stating non-goals up front is the most effective way to keep a time-boxed project on track, and this list maps cleanly to the brief.
- **Honest version trade-off.** Admitting that Angular v16 was chosen for familiarity is better than inventing a technical justification. The conclusion is wrong (F4), but wanting to be able to explain everything in the walkthrough is the right instinct.
- **The "batteries-included" argument.** `HttpClient`, Reactive Forms, the router, and RxJS ship together, which removes dependency-selection decisions. This is the strongest argument in §3 and a legitimate reason to choose Angular.
- **Reproducible run path.** Planning for Docker Compose from the start addresses the brief's "clone and run" requirement.

---

## 3. Detailed findings

### 3.1 Project Summary (§1)

#### F1. Unsupported scale claim (Medium)

> "This platform will be scaled and optimized to process thousands of vehicles per day."

Nothing in the design supports this. There is no database. `GET /vehicles` returns the full inventory. There is no pagination, no caching, and no concurrency strategy. The dataset holds 200 vehicles.

**Recommendation:** Remove the claim from the summary, or move it to a short "Production considerations" section that describes what *would* change at scale: server-side search and pagination, indexed storage, concurrency control on bids, and push-based updates.

**Reasoning:** Reviewers will ask "how?" in the walkthrough. A claim the design does not back up reads as overreach. The same content framed as "what I'd change for production" reads as judgment.

#### F2. Replicating OPENLANE branding (Medium)

**Recommendation:** Treat OPENLANE's visual language as inspiration (palette direction, information density, hierarchy), not as something to copy. Do not use OPENLANE's logo or wordmark; use the project's own name ("The Block"). Put the craft budget into the bid experience instead.

**Reasoning:**
- The reviewers know their own product in detail. A near-copy invites side-by-side comparison, and then every deviation looks like a mistake rather than a choice.
- The brief evaluates whether the result "looks and feels intentional", not whether it matches their app.
- Pixel-matching costs a lot of time for little return inside a 3–4 hour budget.
- Reproducing another company's trademarks in a public repo is an avoidable risk.

#### F3. Vague "additional UX features" (Low)

§1 promises features "based on features available in the Unified OPENLANE App", but §4 lists only login, bid history, and favorites. Either list the features and where each comes from, or remove the sentence. An open-ended promise invites scope creep.

### 3.2 Tech stack and rationale (§2, §3)

#### F4. Angular v16 is end-of-life (High)

Angular v16 was released in May 2023. Under Angular's 18-month support policy, its LTS window closed in November 2024. Its CLI supports only Node.js `^16.14.0 || ^18.10.0`, and both of those Node lines are also EOL (Node 18 ended in April 2025). A new project on v16 means building and containerizing on an unpatched runtime from day one.

The stated reason, unfamiliarity with Signals, does not require v16. In current Angular, Signals are additive. RxJS, `HttpClient`, Reactive Forms, and the `async` pipe are still first-class, and the patterns described in §3 work unchanged on a supported version.

**Recommendation:** Use a currently supported major version (v21 or v22 at the time of writing; verify against angular.dev/reference/releases) and write it in the RxJS-centric style you already know. If you keep v16, record it as an explicit trade-off, spell out the EOL and Node.js implications, and describe an upgrade path.

**Reasoning:** "Why did you start a new project on an EOL framework?" is a predictable walkthrough question. "Because I didn't want to use Signals" is a weak answer when Signals are optional. Using a supported version while deliberately sticking to RxJS is a stronger position, and you also get the esbuild/Vite builder and standalone components by default (see F5).

#### F5. "Vite" listed as a stack choice (Low)

You do not choose Vite in an Angular project; the Angular CLI owns the build. In v16, the esbuild builder (with Vite as its dev server) was a developer preview, and webpack was still the default. From v17 onward, the esbuild/Vite-based `application` builder is the default for new projects.

**Recommendation:** Replace "Vite" with "Angular CLI (esbuild `application` builder)".

**Reasoning:** Listing Vite next to Angular v16 suggests a misunderstanding of the toolchain, and that is easy to probe.

#### F6. Inaccuracies in the stack rationale (Low–Medium)

Each of these is minor alone. Together they weaken an argument that will be discussed directly in the walkthrough's 15-minute "Decisions" segment.

- *"widespread availability of third-party libraries… (i.e. Socket.io)"*: the Socket.io client is framework-agnostic and works the same way with Angular, so it is not a React advantage.
- *"The class makes it easy to … retry failed API calls"*: retry comes from the RxJS `retry` operator, not from `HttpClient`. Auth-token interceptors are also moot here, because authentication is out of scope (§6).
- *"In React, we'd need to write this logic manually using something like Axios"*: Axios has interceptors, so this is not manual. The more relevant React comparison is TanStack Query, which provides retry, caching, and request deduplication.
- *"Auction platforms tend to involve a lot of forms (bid amounts, payment info, seller listings, shipping…)"*: every form on that list except bid amount is out of scope. This project has essentially one form.
- *"Angular has changed quite a bit since the introduction of Signals in Angular v17"*: Signals were introduced in v16 as a developer preview. The core signal APIs became stable in v17.
- *"Angular Universal … available as built-in features of newer versions"*: Angular Universal existed long before v16, and from v17 it became `@angular/ssr`. More importantly, SSR does not matter here, because a buyer portal behind a login gets little from SEO. Either drop the SSR discussion or state that it was not a factor in the decision.

**Recommendation:** Rewrite §3 around the needs of *this* scope:

- familiarity, and being able to explain the code;
- a batteries-included framework;
- RxJS for specific use cases in this app:
  - `debounceTime` + `distinctUntilChanged` + `switchMap` for search, which cancels stale requests;
  - `timer` + `switchMap` for polling the current bid or driving countdowns;
  - `retry({ count, delay })` with backoff for a live-update connection.

**Reasoning:** A short, accurate rationale tied to features you are actually building persuades more than a longer one that leans on hypothetical features.

#### F7. RxJS/WebSockets is the main justification, but there is no real-time design (Medium)

§3 calls WebSocket retry and stream merging "my biggest reason for selecting Angular", yet nothing in §4–§8 describes a real-time channel. Also, in a single-user demo there are no competing bidders, so live updates have nothing to show unless you simulate other bidders.

**Recommendation:** Decide one way or the other:

- **No real-time:** re-fetch the vehicle after a bid, and optionally poll the detail page every N seconds. This is simple, honest, and adequate.
- **Real-time:** use **Server-Sent Events** (`GET /api/vehicles/:id/events`) rather than WebSockets, and keep placing bids with `POST`. Add a small server-side bid simulator if you want to demonstrate "You've been outbid."

**Reasoning:** Bid updates only flow from server to client. SSE is plain HTTP, reconnects automatically through `EventSource`, and needs no extra library, so it fits better than a bidirectional socket. Whichever you choose, the design should match the justification.

#### F8. The backend's role and version are unstated (Medium)

The brief explicitly allows a frontend-only implementation, so the document should say why a backend exists at all.

**Recommendation:** State the reason: **the server is the source of truth for bids.** It validates amounts against the current price and auction state, serializes concurrent bids, and owns time (auction status and countdowns). In addition:

- Pin **Express 5**. It forwards rejected promises from `async` handlers to the error middleware natively; Express 4 does not.
- Use **TypeScript on the server** and share request/response types with the client, for example in an npm-workspaces monorepo with `client/`, `server/`, and `shared/` packages.
- Validate request bodies at the boundary with a schema library such as Zod.

**Reasoning:** "Why build a backend when we said you didn't need one?" is a fair question. Server-authoritative bidding is a good answer, but only if the doc makes it. Shared types eliminate a whole class of client/server contract drift at almost no cost.

#### F9. Persistence for the demo is unspecified (Medium)

"Database will not be necessary" leaves open where bids and favorites live.

**Recommendation:** Say it explicitly. Use an in-memory store seeded from `data/vehicles.json` at startup and reset on restart. Put it behind a small repository interface (for example `VehicleRepository` and `BidRepository`) so it can be swapped for a real database later.

**Reasoning:** The repository seam is what makes the "MySQL in production" line credible. Also, Node's single-threaded event loop makes a synchronous check-and-insert atomic in memory. That is the demo's concurrency story, and it is exactly what has to change when you move to a database, so it is worth writing down.

#### F10. Production database and cloud named without rationale (Low)

"MySQL" and "AWS" are listed with no reasoning, unlike the rest of §3.

**Recommendation:** Remove them, or give one or two sentences each, tied to the domain:

- **Database:** the core requirement for bids is transactional integrity while many bidders hit one row in an auction's final seconds. Either row-level locking (`SELECT … FOR UPDATE`) or optimistic concurrency with a version column handles this, and both MySQL/InnoDB and PostgreSQL support it.
- **Cloud:** name the kinds of service you would need rather than a vendor: a managed relational database, container hosting, a cache for hot auction state, and a push channel for live updates.

**Reasoning:** An unjustified technology choice invites "why not X?" with nothing to anchor the answer.

#### F11. "Jest (Unit tests)" is not a testing strategy (Medium)

Also note that Jest support in Angular v16 was experimental, and Karma/Jasmine was the default. That is another cost of choosing v16.

**Recommendation:** Concentrate testing where the business risk is:

1. **Bid validation rules** (server, unit tests): bid below the minimum increment, bid equal to the current bid, bid on an ended or upcoming auction, non-integer or negative amounts, and the first bid on a vehicle with no bids.
2. **Bid endpoint** (server, integration tests with Supertest): 201 on success with the updated state, 409 when the price has moved, 422 for invalid input, and idempotent replay.
3. **Bid form and bid service** (client): the button is disabled while a request is pending, and error and outbid states are rendered.
4. *(Stretch)* One Playwright end-to-end happy path: search → detail → bid → updated visible state.

**Reasoning:** In 3–4 hours, broad unit coverage of presentational components has little value. Tests around the bid rules protect correctness, and they give you something concrete to show in the walkthrough's "Code" segment.

#### F12. The Docker setup is underspecified (Low)

**Recommendation:**
- Use multi-stage Dockerfiles.
- Serve the built Angular app from nginx and reverse-proxy `/api` to the Express container. The browser then sees a single origin, so no CORS configuration is needed.
- Add a healthcheck to the server container.
- Also document a **non-Docker path** (`npm install && npm run dev` at the repo root, using npm workspaces). A reviewer's Docker environment is a failure point you do not control.

### 3.3 Functional requirements (§4)

#### F13. The bid flow is unspecified (High)

The brief's minimum bar explicitly includes "a bid flow with updated visible state". The doc does not capture this, and none of the rules that decide correct behaviour are defined. The dataset makes several of them unavoidable:

- 112 of 200 vehicles have no bids (`current_bid: null`, `bid_count: 0`), so the minimum bid has to fall back to `starting_bid`.
- 60 vehicles have `reserve_price: null`, meaning no reserve.
- 39 vehicles have a `buy_now_price`.
- `auction_start` values span 2026-03-31 to 2026-04-06. They have **no timezone**, and there is **no end-time field**.

**Recommendation:** Add a "Bidding rules" subsection. The table below lists the minimum decisions; the right-hand column gives example choices.

| Rule | Example decision |
|---|---|
| Minimum next bid | `current_bid + increment`, or `starting_bid` if there are no bids |
| Increment | Fixed (e.g., $100) or tiered by price band. Pick one and document it |
| Currency and representation | CAD (the vehicles are in Canadian provinces), stored as integer dollars, never floating point |
| Auction window | Normalize `auction_start` relative to the server's "now" at boot and add a fixed duration, giving the states `upcoming`, `live`, and `ended`. Choose the normalization so a useful share of the inventory is live whenever a reviewer runs the app; otherwise most vehicles cannot be bid on |
| When bidding is allowed | Only while the status is `live` |
| Timezone | Interpret the dataset timestamps as UTC (or another stated zone). The API returns ISO-8601 timestamps with an offset |
| Reserve | Never expose the amount, since reserve prices are normally confidential to the seller. Expose `reserveMet: boolean`, and show "No reserve" when it is null |
| Buy Now | Decide explicitly whether it is in or out |
| Raising your own bid | Decide whether the current high bidder may raise their own bid, and document it |
| UI state after a bid | Server-confirmed, not optimistic. The button is disabled while the request is pending. On success, show the new current bid, the bid count, and "You're the high bidder". On a 409, show the new price and the new minimum |

**Reasoning:** This is the core interaction of an auction product and the first thing reviewers will try. Every undefined rule becomes an ad-hoc decision during coding, and inconsistent decisions show up as bugs in the demo. Using server-confirmed state for bids is deliberate: a bid is a financial commitment, and the UI should never show a bid the server rejected. Optimistic UI is fine for favorites, which are low-stakes and easy to undo.

#### F14. Search and browse are unspecified (Medium)

"Browse and search" does not say which fields are searchable, which filters exist, or where filtering happens.

**Recommendation:** Specify:
- **Free-text search** over year, make, model, trim, VIN, and lot number.
- **Filters** for make, body style, province, year range, price range, condition grade, and title status.
- **Sort** by auction start or ending soonest, current bid, year, and odometer.
- **Filter state in URL query parameters**, so results can be shared and the back button works.
- **Where filtering happens:** server-side (see F24).

**Reasoning:** Search is the first thing a buyer touches. Keeping filter state in the URL costs little, pays off heavily in UX, and is an easily recognized sign of craft.

#### F15. Login conflicts with "Authentication: out of scope" (Medium)

§4 and §8 include login, but §6 says authentication is out of scope. The brief says user accounts are not required.

**Recommendation:** Drop the login screen. Seed a single demo buyer and treat them as the implicit current user. Issue a mock session (a cookie or bearer token) on first load, or through `POST /api/session`. Reword §6 as: "Credential-based authentication and account management are out of scope; a single seeded demo identity is used."

**Reasoning:** A login button that always succeeds adds a page, a route guard, and an endpoint with no product value, and the brief says to "optimize for clarity over surface area". Keeping an identity *concept* (a session that maps to a user) still lets you build "My Bids" and favorites. It also lets the API be shaped correctly (F22).

#### F16. "My Bids" and Favorites are not defined (Low)

**Recommendation:** Define what each "My Bids" row shows: a vehicle summary, my highest bid, the current price, a status (`winning`, `outbid`, `won`, or `lost`), and time remaining. Favorites are lower priority than bid history and belong below the cut line (§6 of this review).

**Reasoning:** "My Bids" is cheap once the bid flow exists, and it supports the brief's "more trustworthy" stretch theme, because buyers want to know where they stand. Favorites are useful but generic.

### 3.4 Non-functional requirements (§5)

#### F17. These are UI requirements, not NFRs, and the real NFRs are missing (Medium)

The sticky search bar and the brand colors are UI/UX specifications. Responsiveness is a legitimate NFR, but it cannot be tested as written. Meanwhile, performance, accessibility, consistency, and security are absent.

**Recommendation:** Move the UI items into a "UX requirements" subsection and add measurable NFRs, for example:

- **Performance:**
  - the list page is usable on a mid-range mobile device;
  - images are lazy-loaded with explicit dimensions (`NgOptimizedImage`);
  - list responses use a summary projection that omits `condition_report`, `damage_notes`, and the full image arrays;
  - results are paginated.
- **Responsiveness:** verified at 360px, 768px, and 1280px widths, with no horizontal scrolling.
- **Accessibility:** WCAG 2.2 AA, including:
  - a keyboard-operable bid flow;
  - visible focus;
  - labelled inputs;
  - sufficient color contrast (check any brand-derived palette against this);
  - bid results announced to screen readers through an `aria-live` region.
- **Consistency:** the server is the single source of truth for price, bid count, and auction state. The client never decides whether a bid is accepted.
- **Reliability:** submitting a bid is safe to retry (idempotency, F25).
- **Security:**
  - input validation on every write endpoint;
  - no confidential fields, such as the reserve price, in buyer-facing responses.
- **Maintainability:**
  - strict TypeScript;
  - ESLint and Prettier;
  - shared API types.

**Reasoning:** NFRs exist to be verified. "Should be responsive" can never fail a check; "no horizontal scrolling at 360px" can.

#### F18. A sticky search bar on mobile (Low)

A permanently fixed search bar takes up a lot of vertical space on small screens. On narrow viewports, consider a compact sticky bar or one that collapses on scroll, with filters in a drawer.

#### F19. `AUTHOR_README` instead of `README.md` (Medium)

The brief and `SUBMISSION.md` expect the fork's `README.md` to hold the setup instructions, and reviewers will open it first.

**Recommendation:** Replace `README.md` with your own project README, using `SUBMISSION.md` as the starting point. If you want to keep the original brief, move it to `CHALLENGE.md`.

**Reasoning:** A non-standard file name is an avoidable way to fail the "clone and run" requirement.

### 3.5 Out of scope (§6)

#### F20. The non-goals list is incomplete (Low)

Besides fixing the authentication contradiction (F15), add explicit non-goals for:
- auction settlement and closing workflows;
- proxy (automatic) bidding;
- notifications;
- multi-user real-time bidding, unless it is simulated;
- Buy Now, if excluded;
- persistence across restarts.

**Reasoning:** Each of these is a plausible "did you consider…?" question. Writing it down as a non-goal turns an omission into a decision.

### 3.6 Core entities (§7)

#### F21. The entities are names only, with no attributes, relationships, or invariants (Medium)

**Recommendation:** Define at least the following:

```text
Vehicle   (from the dataset; read-only except for auction state)
  id, vin, lot, year, make, model, trim, specs…, condition…, images[], sellingDealership, location
  startingBid, reservePrice (internal only, never serialized to buyers), buyNowPrice?
  currentBid?, bidCount            ← denormalized; updated atomically with the Bid insert
  auctionStart, auctionEnd          ← auctionEnd derived (see F13)

User      id, displayName

Bid       id, vehicleId → Vehicle, userId → User, amount (integer CAD), createdAt (server time)
          invariant: amount ≥ minimum next bid at the moment of acceptance

Favorite  (userId, vehicleId), a unique pair; a many-to-many link between User and Vehicle
```

State that the dataset merges the *vehicle* (the physical asset) and the *listing* (one auction event). Keeping them merged is the right call for the demo. Naming the distinction shows you know that a vehicle can be relisted after a no-sale, which is where a production model would split them.

Use one naming convention in the API. camelCase is idiomatic for JSON consumed by TypeScript, so map from the dataset's snake_case at the repository boundary. The current API mixes the two styles (`offerAmount` vs `current_bid`) and uses two words for one concept ("offer" vs "bid"). Use `amount` on a `Bid`.

**Reasoning:** Bugs come from invariants and relationships. Writing them down takes minutes, and it directly drives the validation code and the tests.

### 3.7 API (§8)

#### F22. Caller identity comes from the request (High)

`POST /bid` accepts `userId` in the body, and reads are keyed by `/users/:userId/…`. Any client can place bids as any user or read any user's bids. This is the Broken Object Level Authorization pattern, API1 in the OWASP API Security Top 10.

**Recommendation:** Derive the user from the session (the mock token or cookie from F15), never from the payload. Place bids with `POST /api/vehicles/:vehicleId/bids` and a body of `{ amount }`, and read the user's data through `/api/me/bids` and `/api/me/favorites`.

**Reasoning:** Authentication being out of scope does not mean the API should be shaped insecurely. Doing it correctly costs the same, and the shape carries over to production unchanged. Reviewers reading the API will notice this.

#### F23. Inconsistent and duplicate endpoints (Medium)

- `GET /bids/:userId` and `GET /users/:userId/bids` return the same data. In `/bids/:x`, the path parameter should identify a bid, not a user.
- `POST /bid` is singular, while every other resource is plural.
- There are no endpoints to **add or remove** a favorite, so the favorites feature cannot be built on this API.
- `GET /users/:userId/bids` returns bids only. The "My Bids" page needs vehicle summaries too, which forces the client into N+1 requests.

#### F24. `GET /vehicles` returns everything (Medium)

Returning the full inventory in full detail works for 200 rows. It contradicts the scale claim (F1), over-fetches for the list view, and, if the dataset objects are returned as-is, sends `reserve_price` to the browser.

**Recommendation:**
- Support `q`, the filters, `sort`, `page`, and `pageSize`.
- Return a summary projection plus `total`.
- Map every response through explicit DTOs, so internal fields such as `reservePrice` cannot leak by accident.

Filtering 200 in-memory items on the server is a few lines of code, so the honest API costs almost nothing.

**Reasoning:** One implementation path holds up conceptually at scale, and the client does not have to change if the data source does. Explicit DTOs are the standard defence against over-exposing fields.

#### F25. No error contract, concurrency control, or idempotency (High for the bid endpoint)

§3 lists "retry failed API calls" as a benefit. But if `POST /bid` times out and is retried, the same bid can be placed twice, because the endpoint is not idempotent.

**Recommendation:**
- **Errors:** use RFC 9457 Problem Details (`application/problem+json`) with a stable code for each failure, such as `BID_TOO_LOW`, `AUCTION_NOT_LIVE`, and `PRICE_CHANGED`.
- **Status codes:**
  - `201` when the bid is accepted, with the updated auction state in the body so the UI can render it directly;
  - `409` when the price has moved since the client last saw it, with the latest state in the body;
  - `422` for validation failures;
  - `404` for an unknown vehicle.
- **Optimistic concurrency:** the client sends the price it bid against (`expectedCurrentBid`), or uses an `ETag` with `If-Match` on the vehicle's version. If the price is stale, the server rejects the bid with `409`.
- **Idempotency:** accept an `Idempotency-Key` header on `POST …/bids` (an IETF HTTPAPI draft, and the convention Stripe uses). A replay with the same key returns the original result. Retry bid requests only when a key is attached.

**Reasoning:** This is the minimum contract that keeps the "bid flow with updated visible state" correct under retries and concurrent bidders. It is also a strong talking point for the walkthrough's "how does this work under the hood" questions.

---

## 4. Proposed API

| Method | Path | Purpose | Notes |
|---|---|---|---|
| `POST` | `/api/session` | Start a demo session | Returns a mock token or cookie for the seeded buyer. Optional if the session is implicit |
| `GET` | `/api/vehicles` | Browse and search | Takes `q`, filters, `sort`, `page`, `pageSize`. Returns `{ items: VehicleSummary[], total, page, pageSize }` |
| `GET` | `/api/vehicles/:vehicleId` | Vehicle detail | Full `VehicleDetail`, with `reserveMet` in place of `reservePrice`. Includes `status`, `auctionEnd`, `minNextBid`, `serverTime` |
| `GET` | `/api/vehicles/:vehicleId/bids` | Bid history | Optional. Anonymize other bidders |
| `POST` | `/api/vehicles/:vehicleId/bids` | Place a bid | Body `{ amount, expectedCurrentBid }` plus an `Idempotency-Key` header. Responds 201, 409, 422, or 404 |
| `GET` | `/api/vehicles/:vehicleId/events` | Live updates | Optional SSE stream (F7) |
| `GET` | `/api/me` | Current user | |
| `GET` | `/api/me/bids` | My bids | Each row embeds a vehicle summary and a `status` |
| `GET` | `/api/me/favorites` | My favorites | Returns `VehicleSummary[]` |
| `PUT` | `/api/me/favorites/:vehicleId` | Add a favorite | Idempotent |
| `DELETE` | `/api/me/favorites/:vehicleId` | Remove a favorite | Idempotent |

Include `serverTime` (or `secondsRemaining`) in responses. The client can then compute countdowns from the server's clock instead of the device clock, which may be wrong.

---

## 5. Missing sections

Add the following sections. Most of them are short.

1. **Goals, constraints, and assumptions**: the 3–4 hour time box, the "prototype, not production" framing, and the dataset assumptions from F13.
2. **Architecture overview**: one diagram showing the browser (Angular SPA) → nginx (static files and the `/api` proxy) → Express API → in-memory repositories seeded from `vehicles.json`.
3. **Frontend architecture**:
   - routes: `/vehicles`, `/vehicles/:id`, `/my-bids`, `/favorites`;
   - lazy-loaded routes;
   - state management: services that expose RxJS observables backed by `BehaviorSubject` (NgRx is not justified at this size);
   - loading and error states;
   - image handling for the external `placehold.co` URLs: alt text, explicit dimensions, and a fallback for when the network is unavailable.
4. **Bidding rules**: as described in F13.
5. **Testing strategy**: as described in F11.
6. **Decision log**: one line for each significant choice, naming the alternative considered and the reason. The choices to cover are the Angular version, backend vs frontend-only, the in-memory store, SSE vs polling vs neither, and no login screen. The walkthrough has a 15-minute "Decisions" segment, and this log is your preparation for it.
7. **Production considerations**: the right home for the scale discussion (F1), MySQL and AWS (F10), real authentication, and real-time bidding.
8. **Delivery plan**: see §6 below.

Also convert the document to Markdown, so headings, tables, and code blocks render on GitHub, where reviewers will read it.

---

## 6. Scope versus the time box

A proposed priority order with an explicit cut line:

| Priority | Item | Why |
|---|---|---|
| P0 | Inventory list with search, filters, and pagination | Minimum bar |
| P0 | Vehicle detail: specs, condition, damage, dealership, photos | Minimum bar |
| P0 | Bid flow: server validation, updated visible state, error and outbid states | Minimum bar; this is where correctness matters |
| P0 | Responsive layout for mobile and desktop | Minimum bar |
| P0 | README with run instructions (npm path and Docker) | Minimum bar |
| P1 | Bid-rule unit tests and bid-endpoint integration tests | Protects the core flow and gives you walkthrough material |
| P1 | My Bids with winning/outbid status | Cheap once bidding exists, and supports "more trustworthy" |
| P1 | Docker Compose | Reproducibility |
| **—** | **Cut line for a 3–4 hour budget** | |
| P2 | Favorites | Useful but generic |
| P2 | Live updates (polling or SSE) with a simulated competing bidder | Shows off RxJS, but only worth it once P0 is solid |
| P2 | Visual polish toward the brand direction | Craft, but only after the behaviour is correct |
| Drop | Login screen | No product value (F15) |

If you decide to go past the time box (the brief allows it), say so in the README and say what the extra time went toward. Reviewers assess "Judgment" too, and that transparency is part of it.

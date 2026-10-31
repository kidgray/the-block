import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * End-to-end tests against the production build (design §14): one Node.js process serves the API
 * and the built client, as in the container. Run `npm run e2e` from the repo root, which builds
 * first. Every run starts from freshly seeded data in an in-memory database.
 */
export default defineConfig({
  testDir: './tests',
  // One server and one database, shared by every test: run them one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node ../server/dist/index.js',
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      NODE_ENV: 'production',
      PORT: String(PORT),
      DB_PATH: ':memory:',
      // The rival bids only when a test asks it to, through the dev endpoint, so runs repeat exactly.
      SIM_BIDDER_ENABLED: 'false',
      ENABLE_DEV_ENDPOINTS: 'true',
      LOG_LEVEL: 'warn',
    },
  },
});

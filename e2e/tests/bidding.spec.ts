import { expect, test, type Page } from '@playwright/test';

interface ListedVehicle {
  id: string;
  auction: { buyNowAvailable: boolean };
}

/** Answers the sign-in dialog that any action requiring a buyer opens. */
async function continueAsDemoBuyer(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continue as Demo Buyer' }).click();
}

test('a buyer searches, opens a live vehicle, and bids', async ({ page }) => {
  await page.goto('/vehicles');

  // Search: the results and the URL follow the search box.
  await page.getByRole('searchbox', { name: 'Search vehicles' }).fill('2023 mazda');
  await expect(page).toHaveURL(/q=2023(\+|%20)mazda/);
  const cards = page.locator('app-vehicle-card');
  await expect(cards).toHaveCount(2); // live and upcoming: the default status filter
  await expect(cards.first()).toContainText('2023 Mazda CX-5');

  // Detail: open the live one.
  await cards
    .filter({ has: page.locator('span.chip.live') })
    .getByRole('link')
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('2023 Mazda CX-5');

  const panel = page.locator('app-bid-panel');
  const bidCount = panel.locator('.fact', { hasText: 'Bids' }).locator('dd');
  const bidsBefore = Number(await bidCount.textContent());
  const bidButton = panel.locator('button.bid-button');
  const amount = (await bidButton.textContent())!.replace('Bid', '').trim();

  // Bid: sign in, confirm the exact amount, and see the result the server returns.
  await bidButton.click();
  await continueAsDemoBuyer(page);
  const confirm = page.getByRole('dialog', { name: 'Confirm your bid' });
  await expect(confirm).toContainText(amount);
  await confirm.getByRole('button', { name: `Place ${amount} bid` }).click();

  await expect(panel.locator('.position')).toContainText("You're the high bidder");
  await expect(panel.locator('.price-fact dd')).toHaveText(amount);
  await expect(bidCount).toHaveText(String(bidsBefore + 1));
  await expect(panel.locator('.message')).toHaveText(
    `Your ${amount} bid was placed. You're the high bidder.`,
  );
  await expect(bidButton).toBeDisabled();
  await expect(page.locator('app-header')).toContainText('Demo Buyer');
});

test('a rival bid arrives live, and the buyer is told they were outbid', async ({
  page,
  request,
}) => {
  const list = await request.get('/api/vehicles?status=live&sort=priceDesc');
  const { items } = (await list.json()) as { items: ListedVehicle[] };
  const vehicle = items.find((item) => !item.auction.buyNowAvailable)!;

  await page.goto(`/vehicles/${vehicle.id}`);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await continueAsDemoBuyer(page);

  const panel = page.locator('app-bid-panel');
  await panel.locator('button.bid-button').click();
  await page.getByRole('button', { name: /^Place .* bid$/ }).click();
  await expect(panel.locator('.position')).toContainText("You're the high bidder");
  const myBid = (await panel.locator('.price-fact dd').textContent())!.trim();

  // The rival counter-bids on the server; the page learns of it over the live stream.
  const rival = await request.post(`/api/dev/vehicles/${vehicle.id}/simulate-bid`, { data: {} });
  expect(rival.status()).toBe(201);

  await expect(panel.locator('.message')).toContainText("You've been outbid");
  await expect(panel.locator('.position')).toContainText("You've been outbid");
  await expect(panel.locator('.price-fact dd')).not.toHaveText(myBid);
  await expect(panel.locator('button.bid-button')).toBeEnabled();
});

test('a buyer saves a vehicle and finds it under Favorites', async ({ page }) => {
  await page.goto('/vehicles');
  const card = page.locator('app-vehicle-card').nth(2);
  const title = (await card.locator('.title').textContent())!.replace(/\s+/g, ' ').trim();

  const heart = card.getByRole('button', { name: `Favorite: ${title}` });
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await heart.click();
  await continueAsDemoBuyer(page);
  await expect(heart).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('link', { name: 'Favorites' }).click();
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(page.locator('app-vehicle-card .title')).toHaveText(title);
});

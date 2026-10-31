import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { VehicleSummary } from '@the-block/shared';
import { auctionState, vehicleSummary } from '../../../testing/fixtures';
import { VehicleCard } from './vehicle-card';

describe('VehicleCard', () => {
  let element: HTMLElement;

  async function render(vehicle: VehicleSummary): Promise<void> {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(VehicleCard);
    fixture.componentRef.setInput('vehicle', vehicle);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  const text = (selector: string) =>
    element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  it('links to the vehicle and shows its key facts', async () => {
    await render(vehicleSummary());
    expect(element.querySelector('a.link')?.getAttribute('href')).toBe('/vehicles/v1');
    expect(text('.title')).toBe('2018 Honda Pilot Touring');
    expect(text('.meta')).toBe('Lot A-0001 · 84,210 km · Calgary, AB');
    expect(text('.grade')).toBe('Grade 4.2');
    expect(text('.chip')).toBe('Live');
    expect(element.querySelector('.title-flag')).toBeNull();
  });

  it('shows the starting bid until someone bids', async () => {
    await render(vehicleSummary());
    expect(text('.price-label')).toBe('Starting bid');
    expect(text('.price')).toBe('$5,500');
    expect(text('.bids')).toBe('0 bids');
  });

  it('shows the current bid once bidding starts', async () => {
    await render(vehicleSummary({ auction: auctionState({ currentBid: 7_000, bidCount: 1 }) }));
    expect(text('.price-label')).toBe('Current bid');
    expect(text('.price')).toBe('$7,000');
    expect(text('.bids')).toBe('1 bid');
  });

  it('shows a Buy Now badge only while Buy Now is offered', async () => {
    await render(
      vehicleSummary({ auction: auctionState({ buyNowPrice: 31_000, buyNowAvailable: true }) }),
    );
    expect(text('.buy-now')).toBe('Buy Now $31,000');

    TestBed.resetTestingModule();
    await render(
      vehicleSummary({ auction: auctionState({ buyNowPrice: 31_000, buyNowAvailable: false }) }),
    );
    expect(element.querySelector('.buy-now')).toBeNull();
  });

  it('flags a salvage title', async () => {
    await render(vehicleSummary({ titleStatus: 'salvage' }));
    expect(text('.title-flag')).toBe('Salvage title');
  });

  it('has a favorite toggle beside the link, never inside it', async () => {
    await render(vehicleSummary());
    const heart = element.querySelector<HTMLButtonElement>('button.favorite');
    expect(heart?.getAttribute('aria-label')).toBe('Favorite: 2018 Honda Pilot Touring');
    expect(heart?.getAttribute('aria-pressed')).toBe('false');
    expect(heart?.closest('a')).toBeNull();
  });
});

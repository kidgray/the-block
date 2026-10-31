import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEVER, of, throwError } from 'rxjs';
import { vehicleDetail } from '../../../testing/fixtures';
import { VehiclesApi } from '../../core/api/vehicles-api';
import { ApiProblem } from '../../core/http/api-problem';
import { VehiclePage } from './vehicle-page';

describe('VehiclePage', () => {
  let element: HTMLElement;
  let get: ReturnType<typeof vi.fn>;

  async function render(getVehicle: ReturnType<typeof vi.fn>): Promise<void> {
    get = getVehicle;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'vehicles/:id', component: VehiclePage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: VehiclesApi, useValue: { get, auctionEvents: () => NEVER } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/vehicles/v1', VehiclePage);
    await harness.fixture.whenStable();
    element = harness.routeNativeElement!;
  }

  const text = (selector: string) =>
    element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  /** The value next to a label in the specifications list. */
  const spec = (label: string) =>
    [...element.querySelectorAll('.specs dt')]
      .find((term) => term.textContent?.trim() === label)
      ?.nextElementSibling?.textContent?.trim();

  it('shows the vehicle, its specs, condition, seller, and bid panel', async () => {
    await render(vi.fn(() => of(vehicleDetail())));

    expect(get).toHaveBeenCalledWith('v1');
    expect(text('h1')).toBe('2018 Honda Pilot Touring');
    expect(text('.subtitle')).toBe('Lot A-0001 · VIN 5FNYF6H95JB000001 · Calgary, AB');
    expect(spec('Engine')).toBe('3.5L V6');
    expect(spec('Odometer')).toBe('84,210 km');
    expect(spec('Drivetrain')).toBe('AWD');
    expect(text('.grade')).toBe('Grade 4.2 / 5 · clean title');
    expect(text('.damage')).toBe('Scratch on rear bumper');
    expect(text('.seller')).toContain('Northside Motors');
    expect(element.querySelector('app-bid-panel')).toBeTruthy();
    expect(element.querySelector('.title-warning')).toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('2018 Honda Pilot Touring · The Block');
  });

  it('prominently flags a salvage title', async () => {
    await render(vi.fn(() => of(vehicleDetail({ titleStatus: 'salvage' }))));
    expect(text('.title-warning strong')).toBe('Salvage title');
  });

  it('says so when the vehicle does not exist', async () => {
    await render(
      vi.fn(() => throwError(() => new ApiProblem(404, 'VEHICLE_NOT_FOUND', 'Not found'))),
    );
    expect(text('h1')).toBe('Vehicle not found');
  });

  it('offers Retry when the vehicle fails to load', async () => {
    await render(vi.fn(() => throwError(() => new ApiProblem(0, 'NETWORK_ERROR', 'Offline'))));
    expect(text('h1')).toBe("Couldn't load this vehicle");
    expect(text('.status button')).toBe('Retry');
  });
});

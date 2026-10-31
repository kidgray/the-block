import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { VehicleImage } from './vehicle-image';

describe('VehicleImage', () => {
  let fixture: ComponentFixture<VehicleImage>;
  let element: HTMLElement;

  async function render(src: string): Promise<void> {
    fixture = TestBed.createComponent(VehicleImage);
    fixture.componentRef.setInput('src', src);
    fixture.componentRef.setInput('alt', '2018 Honda Pilot Touring');
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  async function failToLoad(): Promise<void> {
    element.querySelector('img')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
  }

  it('shows the photo with its alt text', async () => {
    await render('/images/v1-1.jpg');
    const image = element.querySelector('img')!;
    expect(image.getAttribute('src')).toBe('/images/v1-1.jpg');
    expect(image.alt).toBe('2018 Honda Pilot Touring');
  });

  it('shows a labelled placeholder when the photo fails to load', async () => {
    await render('/images/missing.jpg');
    await failToLoad();

    expect(element.querySelector('img')).toBeNull();
    const fallback = element.querySelector('.fallback')!;
    expect(fallback.getAttribute('role')).toBe('img');
    expect(fallback.getAttribute('aria-label')).toBe('2018 Honda Pilot Touring');
    expect(fallback.textContent).toContain('Photo unavailable');
  });

  it('tries again when it is given a different photo', async () => {
    await render('/images/missing.jpg');
    await failToLoad();

    fixture.componentRef.setInput('src', '/images/v1-2.jpg');
    await fixture.whenStable();
    expect(element.querySelector('img')?.getAttribute('src')).toBe('/images/v1-2.jpg');
  });
});

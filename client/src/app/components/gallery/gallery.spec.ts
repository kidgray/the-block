import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Gallery } from './gallery';

describe('Gallery', () => {
  let fixture: ComponentFixture<Gallery>;
  let element: HTMLElement;

  async function render(images: string[]): Promise<void> {
    fixture = TestBed.createComponent(Gallery);
    fixture.componentRef.setInput('images', images);
    fixture.componentRef.setInput('altText', '2018 Honda Pilot Touring');
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  const mainImage = () => element.querySelector<HTMLImageElement>('app-vehicle-image.main img')!;
  const thumbnails = () => [...element.querySelectorAll<HTMLButtonElement>('button.thumb')];

  it('shows the first photo and lets the buyer pick another', async () => {
    await render(['/images/1.jpg', '/images/2.jpg', '/images/3.jpg']);
    expect(mainImage().alt).toBe('2018 Honda Pilot Touring, photo 1 of 3');
    expect(thumbnails().map((thumb) => thumb.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);

    thumbnails()[2]!.click();
    await fixture.whenStable();

    expect(mainImage().getAttribute('src')).toBe('/images/3.jpg');
    expect(mainImage().alt).toBe('2018 Honda Pilot Touring, photo 3 of 3');
    expect(thumbnails()[2]!.getAttribute('aria-pressed')).toBe('true');
  });

  it('hides the thumbnails when there is only one photo', async () => {
    await render(['/images/1.jpg']);
    expect(element.querySelector('.thumbs')).toBeNull();
  });
});

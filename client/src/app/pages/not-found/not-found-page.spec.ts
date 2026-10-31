import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotFoundPage } from './not-found-page';

describe('NotFoundPage', () => {
  it('says the page does not exist and links back to the inventory', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(NotFoundPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Page not found');
    const link = element.querySelector('a')!;
    expect(link.textContent?.trim()).toBe('Browse inventory');
    expect(link.getAttribute('href')).toBe('/vehicles');
  });
});

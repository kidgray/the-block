import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BuyNowConfirmDialog } from './buy-now-confirm-dialog';

describe('BuyNowConfirmDialog', () => {
  let element: HTMLElement;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: { vehicleTitle: '2018 Honda Pilot Touring', price: 31_000 },
        },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const fixture = TestBed.createComponent(BuyNowConfirmDialog);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  function button(label: string): HTMLButtonElement {
    return [...element.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === label,
    )!;
  }

  it('shows the Buy Now price and the vehicle', () => {
    expect(element.querySelector('.price')?.textContent).toBe('$31,000');
    expect(element.textContent).toContain('for the 2018 Honda Pilot Touring');
    expect(element.textContent).toContain('ends the auction immediately');
  });

  it('closes with true to buy, and false on Cancel', () => {
    button('Buy for $31,000').click();
    expect(close).toHaveBeenLastCalledWith(true);
    button('Cancel').click();
    expect(close).toHaveBeenLastCalledWith(false);
  });
});

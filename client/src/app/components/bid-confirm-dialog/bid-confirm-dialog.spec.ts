import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BidConfirmDialog, type BidConfirmData } from './bid-confirm-dialog';

describe('BidConfirmDialog', () => {
  let element: HTMLElement;
  let close: ReturnType<typeof vi.fn>;

  async function render(data: BidConfirmData): Promise<void> {
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const fixture = TestBed.createComponent(BidConfirmDialog);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  function button(label: string): HTMLButtonElement {
    return [...element.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === label,
    )!;
  }

  it('shows the exact amount and the vehicle', async () => {
    await render({ vehicleTitle: '2018 Honda Pilot Touring', amount: 6_500 });
    expect(element.querySelector('.amount')?.textContent).toBe('$6,500');
    expect(element.textContent).toContain('on the 2018 Honda Pilot Touring');
    expect(button('Place $6,500 bid')).toBeTruthy();
  });

  it('closes with true to place the bid', async () => {
    await render({ vehicleTitle: '2018 Honda Pilot Touring', amount: 6_500 });
    button('Place $6,500 bid').click();
    expect(close).toHaveBeenCalledWith(true);
  });

  it('closes with false on Cancel', async () => {
    await render({ vehicleTitle: '2018 Honda Pilot Touring', amount: 6_500 });
    button('Cancel').click();
    expect(close).toHaveBeenCalledWith(false);
  });
});

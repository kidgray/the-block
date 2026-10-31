import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CadPipe } from '../../shared/format/format';

export interface BuyNowConfirmData {
  vehicleTitle: string;
  price: number;
}

/** Shows the Buy Now price before the purchase is submitted (design §8.5). */
@Component({
  selector: 'app-buy-now-confirm-dialog',
  imports: [CadPipe, MatButtonModule, MatDialogModule],
  templateUrl: './buy-now-confirm-dialog.html',
  styleUrl: './buy-now-confirm-dialog.scss',
})
export class BuyNowConfirmDialog {
  protected readonly data = inject<BuyNowConfirmData>(MAT_DIALOG_DATA);
}

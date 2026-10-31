import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CadPipe } from '../../shared/format/format';

export interface BidConfirmData {
  vehicleTitle: string;
  amount: number;
}

/** Shows the exact amount before a bid is submitted (design §8.7). */
@Component({
  selector: 'app-bid-confirm-dialog',
  imports: [CadPipe, MatButtonModule, MatDialogModule],
  templateUrl: './bid-confirm-dialog.html',
  styleUrl: './bid-confirm-dialog.scss',
})
export class BidConfirmDialog {
  protected readonly data = inject<BidConfirmData>(MAT_DIALOG_DATA);
}

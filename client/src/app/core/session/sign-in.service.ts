import { inject, Injectable } from '@angular/core';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { map, type Observable, of } from 'rxjs';
import { SessionService } from './session.service';
import { SignInDialog } from './sign-in-dialog';

@Injectable({ providedIn: 'root' })
export class SignInService {
  private readonly dialog = inject(MatDialog);
  private readonly session = inject(SessionService);
  private openDialog: MatDialogRef<SignInDialog, boolean> | null = null;

  /** Emits true once the buyer is signed in, prompting first if needed; false if they cancel. */
  ensureSignedIn(): Observable<boolean> {
    return this.session.currentUser ? of(true) : this.prompt();
  }

  /** Opens the sign-in dialog, or joins the one already open. */
  prompt(): Observable<boolean> {
    if (!this.openDialog) {
      const ref = this.dialog.open<SignInDialog, void, boolean>(SignInDialog, {
        width: '440px',
        maxWidth: 'calc(100vw - 32px)',
      });
      ref.afterClosed().subscribe(() => (this.openDialog = null));
      this.openDialog = ref;
    }
    return this.openDialog.afterClosed().pipe(map(Boolean));
  }
}

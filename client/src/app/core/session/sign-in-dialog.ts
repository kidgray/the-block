import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { BehaviorSubject } from 'rxjs';
import { SessionService } from './session.service';

interface DialogState {
  pending: boolean;
  error: string | null;
}

@Component({
  selector: 'app-sign-in-dialog',
  imports: [AsyncPipe, MatButtonModule, MatDialogModule],
  template: `
    @let state = state$ | async;
    <h2 mat-dialog-title>Sign in</h2>
    <mat-dialog-content>
      <p>This is a demo, so accounts and passwords aren't implemented.</p>
      <p>Continue as <strong>Demo Buyer</strong> to place bids.</p>
      @if (state?.error; as error) {
        <p class="error" role="alert">{{ error }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close [disabled]="state?.pending">Cancel</button>
      <button mat-flat-button type="button" [disabled]="state?.pending" (click)="confirm()">
        Continue as Demo Buyer
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .error {
      color: var(--mat-sys-error);
    }
  `,
})
export class SignInDialog {
  private readonly session = inject(SessionService);
  private readonly dialogRef = inject<MatDialogRef<SignInDialog, boolean>>(MatDialogRef);

  protected readonly state$ = new BehaviorSubject<DialogState>({ pending: false, error: null });

  protected confirm(): void {
    this.state$.next({ pending: true, error: null });
    this.session.signIn().subscribe({
      next: () => this.dialogRef.close(true),
      error: () =>
        this.state$.next({
          pending: false,
          error: "Couldn't sign in. Check that the API server is running, then try again.",
        }),
    });
  }
}

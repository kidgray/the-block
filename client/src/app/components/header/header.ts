import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { type IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
import { SessionService } from '../../core/session/session.service';
import { SignInService } from '../../core/session/sign-in.service';

@Component({
  selector: 'app-header',
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly session = inject(SessionService);
  private readonly signIn = inject(SignInService);

  protected readonly user$ = this.session.user$;
  /** "Inventory" is the current page only on the list itself, whatever its query parameters. */
  protected readonly exactPath: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  };

  protected signInClicked(): void {
    this.signIn.ensureSignedIn().subscribe();
  }

  protected signOutClicked(): void {
    this.session.signOut().subscribe();
  }
}

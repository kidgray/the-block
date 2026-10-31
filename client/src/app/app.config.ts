import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import {
  authInterceptor,
  idempotencyRetryInterceptor,
  problemInterceptor,
} from './core/http/interceptors';
import { SessionService } from './core/session/session.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    // Requests pass through these outermost-first; responses come back innermost-first:
    // retries happen before errors are mapped to ApiProblem, and auth sees the mapped problem.
    provideHttpClient(
      withInterceptors([authInterceptor, problemInterceptor, idempotencyRetryInterceptor]),
    ),
    provideAppInitializer(() => firstValueFrom(inject(SessionService).restore())),
  ],
};

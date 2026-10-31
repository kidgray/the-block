import type { Routes } from '@angular/router';
import { signInGuard } from './core/session/sign-in.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'vehicles' },
  {
    path: 'vehicles',
    title: 'Inventory · The Block',
    loadComponent: () => import('./pages/inventory/inventory-page').then((m) => m.InventoryPage),
  },
  {
    path: 'vehicles/:id',
    title: 'Vehicle · The Block',
    loadComponent: () => import('./pages/vehicle/vehicle-page').then((m) => m.VehiclePage),
  },
  {
    path: 'my-bids',
    title: 'My Bids · The Block',
    canActivate: [signInGuard],
    loadComponent: () => import('./pages/my-bids/my-bids-page').then((m) => m.MyBidsPage),
  },
  {
    path: 'favorites',
    title: 'Favorites · The Block',
    canActivate: [signInGuard],
    loadComponent: () => import('./pages/favorites/favorites-page').then((m) => m.FavoritesPage),
  },
  {
    path: '**',
    title: 'Page not found · The Block',
    loadComponent: () => import('./pages/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];

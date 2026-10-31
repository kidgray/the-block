import { Injectable } from '@angular/core';
import type { Params } from '@angular/router';

/** Remembers the last inventory query so "Back to results" restores the buyer's search and filters. */
@Injectable({ providedIn: 'root' })
export class InventoryHistory {
  lastQueryParams: Params = {};
}

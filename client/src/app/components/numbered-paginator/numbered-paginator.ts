import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

export type PageItem = number | 'gap';

/** First, last, and a window around the current page, with gaps: 1 … 4 5 6 … 9. */
export function pageItems(page: number, pageCount: number): PageItem[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const items: PageItem[] = [];
  sorted.forEach((n, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && n - previous === 2) items.push(previous + 1);
    else if (previous !== undefined && n - previous > 2) items.push('gap');
    items.push(n);
  });
  return items;
}

/**
 * Numbered pages as real links with query parameters, so every page has its own URL (design D16).
 * Material's paginator only offers previous/next, hence this component (design §13.5).
 */
@Component({
  selector: 'app-numbered-paginator',
  imports: [MatIconModule, RouterLink],
  templateUrl: './numbered-paginator.html',
  styleUrl: './numbered-paginator.scss',
})
export class NumberedPaginator {
  @Input({ required: true }) page!: number;
  @Input({ required: true }) total!: number;
  @Input({ required: true }) pageSize!: number;

  protected get pageCount(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  protected get items(): PageItem[] {
    return pageItems(this.page, this.pageCount);
  }

  /** Page 1 is the default, so it is left out of the URL. */
  protected paramsFor(page: number): { page: number | null } {
    return { page: page === 1 ? null : page };
  }
}

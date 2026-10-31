import { pageItems } from './numbered-paginator';

describe('pageItems', () => {
  it('lists every page when there are few', () => {
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
  });

  it('shows a window around the current page with gaps', () => {
    expect(pageItems(5, 9)).toEqual([1, 'gap', 4, 5, 6, 'gap', 9]);
  });

  it('fills a single missing page instead of showing a gap', () => {
    expect(pageItems(4, 9)).toEqual([1, 2, 3, 4, 5, 'gap', 9]);
  });

  it('handles the first and last pages', () => {
    expect(pageItems(1, 8)).toEqual([1, 2, 'gap', 8]);
    expect(pageItems(8, 8)).toEqual([1, 'gap', 7, 8]);
  });
});

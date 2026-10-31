import { Pipe, type PipeTransform } from '@angular/core';

const cad = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat('en-CA');

/** Money is whole CAD dollars everywhere (design §8.1). */
export function formatCad(amount: number): string {
  return cad.format(amount);
}

@Pipe({ name: 'cad' })
export class CadPipe implements PipeTransform {
  transform(amount: number | null | undefined): string {
    return amount === null || amount === undefined ? '—' : formatCad(amount);
  }
}

@Pipe({ name: 'km' })
export class KmPipe implements PipeTransform {
  transform(distance: number): string {
    return `${integer.format(distance)} km`;
  }
}

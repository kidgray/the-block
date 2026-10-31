import { NgOptimizedImage } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** A 4:3 vehicle photo with a local fallback when the image fails to load (design §13.6). */
@Component({
  selector: 'app-vehicle-image',
  imports: [NgOptimizedImage, MatIconModule],
  templateUrl: './vehicle-image.html',
  styleUrl: './vehicle-image.scss',
})
export class VehicleImage {
  private source = '';
  protected failed = false;

  @Input({ required: true }) set src(value: string) {
    if (value !== this.source) this.failed = false;
    this.source = value;
  }
  get src(): string {
    return this.source;
  }

  @Input() alt = '';
  @Input() priority = false;
}

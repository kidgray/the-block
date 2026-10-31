import { Component, Input } from '@angular/core';
import { VehicleImage } from '../vehicle-image/vehicle-image';

@Component({
  selector: 'app-gallery',
  imports: [VehicleImage],
  templateUrl: './gallery.html',
  styleUrl: './gallery.scss',
})
export class Gallery {
  @Input({ required: true }) images: string[] = [];
  @Input({ required: true }) altText = '';
  protected selected = 0;
}

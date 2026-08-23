import { Pipe, PipeTransform } from '@angular/core';
import { formatPartialDate } from '../utils/partial-date';

@Pipe({ name: 'partialDate' })
export class PartialDatePipe implements PipeTransform {
  transform(value: string): string {
    return formatPartialDate(value);
  }
}

import { FormControl } from '@angular/forms';
import {
  commaSeparatedContactNumbersValidator,
  contactNumberValidator,
} from './contact-number.validator';

describe('contact number validators', () => {
  it('allows digits, spaces, plus and hyphen characters', () => {
    const control = new FormControl('+91 98765-43210', {
      nonNullable: true,
      validators: contactNumberValidator,
    });

    expect(control.valid).toBe(true);
  });

  it('rejects letters and other special characters', () => {
    const control = new FormControl('+91 (98765) call', {
      nonNullable: true,
      validators: contactNumberValidator,
    });

    expect(control.hasError('contactNumber')).toBe(true);
  });

  it('validates every number in a comma-separated list', () => {
    const control = new FormControl('+91 98765-43210, 044-2222 3333', {
      nonNullable: true,
      validators: commaSeparatedContactNumbersValidator,
    });

    expect(control.valid).toBe(true);

    control.setValue('+91 98765-43210, (044) 2222');
    expect(control.errors?.['invalidContacts']).toEqual(['(044) 2222']);
  });
});

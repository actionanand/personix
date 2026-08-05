import { FormControl } from '@angular/forms';
import {
  commaSeparatedEmailsValidator,
  isValidEmailAddress,
} from './comma-separated-emails.validator';

describe('commaSeparatedEmailsValidator', () => {
  const control = new FormControl('', {
    nonNullable: true,
    validators: commaSeparatedEmailsValidator,
  });

  it('validates a single email before it becomes a pill', () => {
    expect(isValidEmailAddress('family@example.com')).toBe(true);
    expect(isValidEmailAddress('ccc')).toBe(false);
  });

  it('allows an empty optional email list', () => {
    control.setValue('');

    expect(control.valid).toBe(true);
  });

  it('allows multiple valid comma-separated email addresses', () => {
    control.setValue('family@example.com, claims@example.org');

    expect(control.valid).toBe(true);
  });

  it('reports every invalid email address', () => {
    control.setValue('family@example.com, wrong-address, missing@');

    expect(control.errors?.['invalidEmails']).toEqual(['wrong-address', 'missing@']);
  });
});

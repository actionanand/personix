import { FormControl, Validators } from '@angular/forms';
import type { ValidationErrors, ValidatorFn } from '@angular/forms';

export function isValidEmailAddress(value: string): boolean {
  return Validators.email(new FormControl(value.trim(), { nonNullable: true })) === null;
}

export const commaSeparatedEmailsValidator: ValidatorFn = (control): ValidationErrors | null => {
  if (typeof control.value !== 'string' || !control.value.trim()) return null;

  const invalidEmails = control.value
    .split(',')
    .map((email: string) => email.trim())
    .filter(Boolean)
    .filter((email: string) => !isValidEmailAddress(email));

  return invalidEmails.length ? { invalidEmails } : null;
};

import type { ValidationErrors, ValidatorFn } from '@angular/forms';

const CONTACT_NUMBER_PATTERN = /^[\d+\- ]+$/;

function isContactNumber(value: string): boolean {
  return /\d/.test(value) && CONTACT_NUMBER_PATTERN.test(value);
}

export const contactNumberValidator: ValidatorFn = (control): ValidationErrors | null => {
  if (typeof control.value !== 'string' || !control.value.trim()) return null;

  return isContactNumber(control.value.trim()) ? null : { contactNumber: true };
};

export const commaSeparatedContactNumbersValidator: ValidatorFn = (
  control,
): ValidationErrors | null => {
  if (typeof control.value !== 'string' || !control.value.trim()) return null;

  const contacts = control.value
    .split(',')
    .map((contact: string) => contact.trim())
    .filter(Boolean);
  const invalidContacts = contacts.filter((contact: string) => !isContactNumber(contact));

  return contacts.length && !invalidContacts.length ? null : { invalidContacts };
};

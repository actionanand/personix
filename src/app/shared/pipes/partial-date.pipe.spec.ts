import { describe, expect, it } from 'vitest';
import { buildPartialDate, formatPartialDate, partialDateSortKey } from '../utils/partial-date';

describe('partial dates', () => {
  it('supports year, month and exact-day precision', () => {
    expect(buildPartialDate({ year: '2019', month: '', day: '' })).toBe('2019');
    expect(buildPartialDate({ year: '2019', month: '07', day: '' })).toBe('2019-07');
    expect(buildPartialDate({ year: '2019', month: '07', day: '21' })).toBe('2019-07-21');
  });

  it('rejects a day without a month and invalid calendar dates', () => {
    expect(buildPartialDate({ year: '2019', month: '', day: '21' })).toBe('');
    expect(buildPartialDate({ year: '2025', month: '02', day: '29' })).toBe('');
  });

  it('formats the available precision without inventing missing values', () => {
    expect(formatPartialDate('2019')).toBe('2019');
    expect(formatPartialDate('2019-07')).toBe('Jul 2019');
    expect(formatPartialDate('2019-07-21')).toBe('Jul 21, 2019');
  });

  it('creates stable beginning and end sort keys', () => {
    expect(partialDateSortKey('2019')).toBe('2019-01-01');
    expect(partialDateSortKey('2019', true)).toBe('2019-12-31');
  });
});

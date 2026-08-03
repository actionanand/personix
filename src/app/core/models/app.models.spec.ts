import {
  NAKSHATRA_OPTIONS,
  RASI_OPTIONS,
  normalizeText,
  normalizeVehicleRegistration,
} from './app.models';

describe('Personix model helpers', () => {
  it('normalizes vehicle registrations while preserving the stored display value elsewhere', () => {
    expect(normalizeVehicleRegistration('TN 07 ab-1234')).toBe('TN07AB1234');
  });

  it('normalizes partial search text', () => {
    expect(normalizeText('  Medical INSURANCE ')).toBe('medical insurance');
  });

  it('provides complete local Rasi and Nakshatra names in English and Tamil', () => {
    expect(RASI_OPTIONS).toHaveLength(12);
    expect(NAKSHATRA_OPTIONS).toHaveLength(27);
    expect(RASI_OPTIONS.every((item) => item.english && item.tamil)).toBe(true);
    expect(NAKSHATRA_OPTIONS.every((item) => item.english && item.tamil)).toBe(true);
  });
});

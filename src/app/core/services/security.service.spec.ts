import { TestBed } from '@angular/core/testing';
import { SecurityService } from './security.service';

describe('SecurityService', () => {
  let service: SecurityService;

  beforeEach(() => {
    service = TestBed.inject(SecurityService);
  });

  it('stores a versioned salted verifier rather than the PIN', async () => {
    const parameters = await service.createPin('2468');
    expect(parameters.version).toBe(1);
    expect(parameters.iterations).toBeGreaterThanOrEqual(300_000);
    expect(parameters.verifier).not.toContain('2468');
    await expect(service.verifyPin('2468', parameters)).resolves.toBe(true);
    await expect(service.verifyPin('1111', parameters)).resolves.toBe(false);
  });

  it('requires a 4–8 digit PIN', async () => {
    await expect(service.createPin('12ab')).rejects.toThrow(/numeric PIN/i);
  });
});

import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  const service = new CryptoService();

  it('encrypts and authenticates a backup payload', async () => {
    const encrypted = await service.encrypt(
      '{"private":"record"}',
      'correct horse battery staple',
      10_000,
    );
    expect(encrypted.ciphertext).not.toContain('private');
    await expect(service.decrypt(encrypted, 'correct horse battery staple')).resolves.toBe(
      '{"private":"record"}',
    );
  });

  it('rejects an incorrect password or corrupted backup', async () => {
    const encrypted = await service.encrypt('sensitive', 'valid-password', 10_000);
    await expect(service.decrypt(encrypted, 'wrong-password')).rejects.toThrow(
      /incorrect|damaged/i,
    );
  });
});

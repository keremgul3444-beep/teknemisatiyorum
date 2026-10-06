import { describe, expect, it, vi } from 'vitest';

describe('mediaPath', () => {
  it('göreli yolu ve API adresli imzalı bağlantıyı kabul eder, yabancı adresi reddeder', async () => {
    vi.stubEnv('API_PUBLIC_URL', 'https://api.teknemisatiyorum.com');
    vi.resetModules();
    const { mediaPath } = await import('@/lib/mediaPath');
    expect(mediaPath('/media/abc/raw?exp=1&sig=x')).toBe('/media/abc/raw?exp=1&sig=x');
    expect(mediaPath('https://api.teknemisatiyorum.com/media/abc/raw?exp=1&sig=x')).toBe('/media/abc/raw?exp=1&sig=x');
    expect(mediaPath('https://kotu.example/media/abc/raw')).toBeNull();
    expect(mediaPath('https://api.teknemisatiyorum.com/admin')).toBeNull();
    vi.unstubAllEnvs();
  });
});

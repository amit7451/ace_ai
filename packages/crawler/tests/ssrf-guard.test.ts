import {
  isBlockedIp,
  assertValidSeedUrl,
  resolvePublicAddress,
  SsrfBlockedError,
} from '../src/ssrf-guard';

describe('isBlockedIp', () => {
  it('blocks RFC1918 private ranges', () => {
    expect(isBlockedIp('10.0.0.1')).toBe(true);
    expect(isBlockedIp('172.16.5.1')).toBe(true);
    expect(isBlockedIp('192.168.1.1')).toBe(true);
  });

  it('blocks loopback', () => {
    expect(isBlockedIp('127.0.0.1')).toBe(true);
    expect(isBlockedIp('::1')).toBe(true);
  });

  it('blocks link-local, including the cloud metadata address', () => {
    expect(isBlockedIp('169.254.169.254')).toBe(true);
    expect(isBlockedIp('169.254.1.1')).toBe(true);
  });

  it('blocks IPv6 unique-local addresses', () => {
    expect(isBlockedIp('fc00::1')).toBe(true);
    expect(isBlockedIp('fd12:3456:789a::1')).toBe(true);
  });

  it('blocks IPv4-mapped IPv6 loopback', () => {
    expect(isBlockedIp('::ffff:127.0.0.1')).toBe(true);
  });

  it('allows well-known public IPs', () => {
    expect(isBlockedIp('8.8.8.8')).toBe(false);
    expect(isBlockedIp('1.1.1.1')).toBe(false);
  });

  it('blocks CGNAT range', () => {
    expect(isBlockedIp('100.64.0.5')).toBe(true);
  });

  it('does not false-positive on public ranges that are numerically close to blocked ones', () => {
    // 11.0.0.0/8 is public (was DoD, now largely public/reassigned in test terms) — sanity check the mask math isn't off-by-one.
    expect(isBlockedIp('11.0.0.1')).toBe(false);
    // 169.253.x.x is just outside the 169.254.0.0/16 link-local block.
    expect(isBlockedIp('169.253.1.1')).toBe(false);
  });
});

describe('assertValidSeedUrl', () => {
  it('accepts a normal https URL', () => {
    expect(() => assertValidSeedUrl('https://example.com/docs')).not.toThrow();
  });

  it('rejects non-http(s) protocols', () => {
    expect(() => assertValidSeedUrl('ftp://example.com')).toThrow(SsrfBlockedError);
    expect(() => assertValidSeedUrl('file:///etc/passwd')).toThrow(SsrfBlockedError);
  });

  it('rejects malformed URLs', () => {
    expect(() => assertValidSeedUrl('not a url')).toThrow(SsrfBlockedError);
  });

  it('rejects credentials embedded in the URL', () => {
    expect(() => assertValidSeedUrl('https://user:pass@example.com')).toThrow(SsrfBlockedError);
  });

  it('rejects localhost by name', () => {
    expect(() => assertValidSeedUrl('http://localhost:3000')).toThrow(SsrfBlockedError);
    expect(() => assertValidSeedUrl('http://foo.localhost')).toThrow(SsrfBlockedError);
  });

  it('rejects an IP-literal seed URL pointing at a private address', () => {
    expect(() => assertValidSeedUrl('http://127.0.0.1:6379')).toThrow(SsrfBlockedError);
    expect(() => assertValidSeedUrl('http://169.254.169.254/latest/meta-data/')).toThrow(
      SsrfBlockedError
    );
  });

  it('allows an IP-literal seed URL pointing at a public address', () => {
    expect(() => assertValidSeedUrl('http://8.8.8.8')).not.toThrow();
  });
});

describe('resolvePublicAddress', () => {
  it('returns the address directly for a public IP literal without a DNS lookup', async () => {
    const result = await resolvePublicAddress('1.1.1.1');
    expect(result.address).toBe('1.1.1.1');
    expect(result.family).toBe(4);
  });

  it('throws for a private IP literal', async () => {
    await expect(resolvePublicAddress('10.0.0.5')).rejects.toThrow(SsrfBlockedError);
  });
});

import {
  isBlockedIp,
  isBlockedHostname,
  isBlockedPort,
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
    expect(isBlockedIp('11.0.0.1')).toBe(false);
    expect(isBlockedIp('169.253.1.1')).toBe(false);
  });
});

describe('isBlockedHostname & isBlockedPort', () => {
  it('blocks internal docker service hostnames', () => {
    expect(isBlockedHostname('postgres')).toBe(true);
    expect(isBlockedHostname('redis')).toBe(true);
    expect(isBlockedHostname('qdrant')).toBe(true);
    expect(isBlockedHostname('api')).toBe(true);
    expect(isBlockedHostname('worker')).toBe(true);
    expect(isBlockedHostname('dashboard')).toBe(true);
    expect(isBlockedHostname('nginx')).toBe(true);
  });

  it('blocks internal cloud metadata hostnames', () => {
    expect(isBlockedHostname('metadata.google.internal')).toBe(true);
    expect(isBlockedHostname('instance-data')).toBe(true);
    expect(isBlockedHostname('host.docker.internal')).toBe(true);
  });

  it('blocks internal domain suffixes', () => {
    expect(isBlockedHostname('db.local')).toBe(true);
    expect(isBlockedHostname('service.internal')).toBe(true);
    expect(isBlockedHostname('router.lan')).toBe(true);
    expect(isBlockedHostname('intranet.corp')).toBe(true);
  });

  it('allows public hostnames', () => {
    expect(isBlockedHostname('example.com')).toBe(false);
    expect(isBlockedHostname('docs.github.com')).toBe(false);
  });

  it('blocks sensitive internal ports', () => {
    expect(isBlockedPort(5432)).toBe(true);
    expect(isBlockedPort(6379)).toBe(true);
    expect(isBlockedPort(6333)).toBe(true);
    expect(isBlockedPort(22)).toBe(true);
    expect(isBlockedPort(11434)).toBe(true);
    expect(isBlockedPort(2375)).toBe(true);
  });

  it('allows standard web ports', () => {
    expect(isBlockedPort(80)).toBe(false);
    expect(isBlockedPort(443)).toBe(false);
    expect(isBlockedPort(8080)).toBe(false);
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

  it('rejects localhost and internal hostnames by name', () => {
    expect(() => assertValidSeedUrl('http://localhost:3000')).toThrow(SsrfBlockedError);
    expect(() => assertValidSeedUrl('http://foo.localhost')).toThrow(SsrfBlockedError);
    expect(() => assertValidSeedUrl('http://redis/keys')).toThrow(SsrfBlockedError);
    expect(() => assertValidSeedUrl('http://postgres:5432')).toThrow(SsrfBlockedError);
    expect(() => assertValidSeedUrl('http://qdrant:6333')).toThrow(SsrfBlockedError);
    expect(() => assertValidSeedUrl('http://service.internal')).toThrow(SsrfBlockedError);
  });

  it('rejects sensitive internal ports', () => {
    expect(() => assertValidSeedUrl('http://example.com:5432')).toThrow(SsrfBlockedError);
    expect(() => assertValidSeedUrl('http://example.com:6379')).toThrow(SsrfBlockedError);
    expect(() => assertValidSeedUrl('http://example.com:22')).toThrow(SsrfBlockedError);
  });

  it('rejects an IP-literal seed URL pointing at a private address', () => {
    expect(() => assertValidSeedUrl('http://127.0.0.1:8080')).toThrow(SsrfBlockedError);
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

  it('throws for internal hostnames', async () => {
    await expect(resolvePublicAddress('redis')).rejects.toThrow(SsrfBlockedError);
    await expect(resolvePublicAddress('postgres')).rejects.toThrow(SsrfBlockedError);
    await expect(resolvePublicAddress('service.internal')).rejects.toThrow(SsrfBlockedError);
  });
});

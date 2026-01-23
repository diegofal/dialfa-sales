import { createToken, verifyToken, type JWTPayload } from '../jwt';

describe('createToken', () => {
  const validPayload: JWTPayload = {
    userId: 1,
    username: 'admin',
    email: 'admin@test.com',
    role: 'ADMIN',
    fullName: 'Admin User',
  };

  it('returns a non-empty JWT string', async () => {
    const token = await createToken(validPayload);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('returns a token with three dot-separated parts (header.payload.signature)', async () => {
    const token = await createToken(validPayload);
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
  });

  it('encodes the payload fields into the token', async () => {
    const token = await createToken(validPayload);
    const result = await verifyToken(token);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe(1);
    expect(result!.username).toBe('admin');
    expect(result!.email).toBe('admin@test.com');
    expect(result!.role).toBe('ADMIN');
    expect(result!.fullName).toBe('Admin User');
  });

  it('produces different tokens for different payloads', async () => {
    const token1 = await createToken(validPayload);
    const token2 = await createToken({ ...validPayload, userId: 2, username: 'other' });
    expect(token1).not.toBe(token2);
  });

  it('uses HS256 algorithm in the header', async () => {
    const token = await createToken(validPayload);
    const headerPart = token.split('.')[0];
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString());
    expect(header.alg).toBe('HS256');
  });
});

describe('verifyToken', () => {
  const validPayload: JWTPayload = {
    userId: 5,
    username: 'testuser',
    email: 'test@example.com',
    role: 'USER',
    fullName: 'Test User',
  };

  it('verifies a valid token and returns the payload', async () => {
    const token = await createToken(validPayload);
    const result = await verifyToken(token);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe(5);
    expect(result!.username).toBe('testuser');
  });

  it('returns null for a tampered token', async () => {
    const token = await createToken(validPayload);
    // Tamper with the signature
    const tampered = token.slice(0, -5) + 'XXXXX';
    const result = await verifyToken(tampered);
    expect(result).toBeNull();
  });

  it('returns null for a completely invalid string', async () => {
    const result = await verifyToken('not-a-jwt-token');
    expect(result).toBeNull();
  });

  it('returns null for an empty string', async () => {
    const result = await verifyToken('');
    expect(result).toBeNull();
  });

  it('preserves all payload fields through encode/decode cycle', async () => {
    const payload: JWTPayload = {
      userId: 999,
      username: 'special_user',
      email: 'special@domain.org',
      role: 'MANAGER',
      fullName: 'Special Manager User',
    };
    const token = await createToken(payload);
    const decoded = await verifyToken(token);

    expect(decoded).toMatchObject(payload);
  });

  it('includes standard JWT claims (iss, aud, iat, exp)', async () => {
    const token = await createToken(validPayload);
    const payloadPart = token.split('.')[1];
    const raw = JSON.parse(Buffer.from(payloadPart, 'base64url').toString());
    expect(raw.iss).toBe('spisa-api');
    expect(raw.aud).toBe('spisa-frontend');
    expect(raw.iat).toBeDefined();
    expect(raw.exp).toBeDefined();
  });
});

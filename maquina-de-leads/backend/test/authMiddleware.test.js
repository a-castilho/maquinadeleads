const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../src/middleware/auth');

test('requireAuth exposes both sub and id for authenticated controllers', () => {
  process.env.JWT_SECRET = 'test-secret-for-auth-middleware';
  const userId = '11111111-1111-4111-8111-111111111111';
  const token = jwt.sign({ sub: userId, email: 'teste@example.com' }, process.env.JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` } };
  let statusCode = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json() { return this; },
  };
  let nextCalled = false;

  requireAuth(req, res, () => { nextCalled = true; });

  assert.equal(statusCode, null);
  assert.equal(nextCalled, true);
  assert.equal(req.user.sub, userId);
  assert.equal(req.user.id, userId);
});

test('requireAuth rejects token without subject', () => {
  process.env.JWT_SECRET = 'test-secret-for-auth-middleware';
  const token = jwt.sign({ email: 'teste@example.com' }, process.env.JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` } };
  let statusCode = null;
  let body = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };

  requireAuth(req, res, () => assert.fail('next must not be called'));

  assert.equal(statusCode, 401);
  assert.match(body.error, /identificador/i);
});

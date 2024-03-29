const app = require('../src/app');
const supertest = require('supertest');

jest.test('adds 1 + 2 to equal 3', () => {
    const res = supertest.request(app)
        .get('/');

  jest.expect(res.status).toBe(200);
});

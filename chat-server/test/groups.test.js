// chat-server/test/groups.test.js
const request = require('supertest');
const { expect } = require('chai');

// If your server runs on a different port, change this:
const BASE = process.env.TEST_BASE || 'http://127.0.0.1:4000';

describe('Groups API', () => {
  let groupId;

  // Small helper to fetch one group from /groups
  async function fetchGroupById(id) {
    const res = await request(BASE).get('/groups');
    expect(res.status).to.equal(200);
    return (res.body || []).find(g => g.id === id);
  }

  it('health endpoint returns ok', async () => {
    const res = await request(BASE).get('/health');
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('ok', true);
  });

  it('creates a group', async () => {
    const res = await request(BASE)
      .post('/groups')
      .send({ name: 'Phase2 Test Group', creatorId: '1' });

    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('id');
    expect(res.body).to.include.keys(['name', 'creatorId', 'users', 'channels', 'joinRequests']);

    groupId = res.body.id;

    // sanity: creator should be in users
    expect(res.body.users).to.include('1');
  });

  it('lists groups and contains the newly created group', async () => {
    const res = await request(BASE).get('/groups');
    expect(res.status).to.equal(200);

    const found = (res.body || []).find(g => g.id === groupId);
    expect(found, 'created group should be visible via GET /groups').to.exist;
    expect(found.name).to.equal('Phase2 Test Group');
  });

  it('user 3 requests to join', async () => {
    const res = await request(BASE)
      .post(`/groups/${groupId}/join`)
      .send({ userId: '3' });

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('ok', true);

    const g = await fetchGroupById(groupId);
    expect(g).to.exist;
    expect(g.joinRequests || []).to.include('3');
  });

  it('approves join request for user 3', async () => {
    const res = await request(BASE)
      .put(`/groups/${groupId}/approve/3`)
      .send();

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('id', groupId);

    // user 3 should now be a member; joinRequests cleared
    expect(res.body.users || []).to.include('3');
    expect(res.body.joinRequests || []).to.not.include('3');
  });

  it('user 3 can leave the group', async () => {
    const res = await request(BASE)
      .post(`/groups/${groupId}/leave`)
      .send({ userId: '3' });

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('ok', true);

    const g = await fetchGroupById(groupId);
    expect(g.users || []).to.not.include('3');
  });

  // Clean up the test group so your DB/JSON stays tidy
  after(async () => {
    if (!groupId) return;
    try {
      const res = await request(BASE).delete(`/groups/${groupId}`);
      expect([200, 204]).to.include(res.status);
    } catch {
      // ignore cleanup failures
    }
  });
});

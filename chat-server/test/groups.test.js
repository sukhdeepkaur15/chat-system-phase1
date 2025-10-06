const { expect } = require('chai');
const supertest = require('supertest');

// Use the exported app/server so we don't need a running server in another terminal
const { app, server } = require('../index');
const request = supertest(app);

describe('Groups API', () => {
  let groupId;

  // Small helper to fetch one group from /groups
  async function fetchGroupById(id) {
    const res = await request.get('/groups');
    expect(res.status).to.equal(200);
    return (res.body || []).find(g => g.id === id);
  }

  it('health endpoint returns ok', async () => {
    const res = await request.get('/health');
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('ok', true);
  });

  it('creates a group', async () => {
    const res = await request
      .post('/groups')
      .send({ name: 'Phase2 Test Group', creatorId: '1' });

    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('id');
    expect(res.body).to.include.keys(['name', 'creatorId', 'users', 'channels', 'joinRequests']);

    groupId = res.body.id;
    expect(res.body.users).to.include('1'); // creator
  });

  it('lists groups and contains the newly created group', async () => {
    const res = await request.get('/groups');
    expect(res.status).to.equal(200);

    const found = (res.body || []).find(g => g.id === groupId);
    expect(found, 'created group should be visible via GET /groups').to.exist;
    expect(found.name).to.equal('Phase2 Test Group');
  });

  it('user 3 requests to join', async () => {
    const res = await request
      .post(`/groups/${groupId}/join`)
      .send({ userId: '3' });

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('ok', true);

    const g = await fetchGroupById(groupId);
    expect(g).to.exist;
    expect(g.joinRequests || []).to.include('3');
  });

  it('approves join request for user 3', async () => {
    const res = await request
      .put(`/groups/${groupId}/approve/3`)
      .send();

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('id', groupId);

    expect(res.body.users || []).to.include('3');
    expect(res.body.joinRequests || []).to.not.include('3');
  });

  it('user 3 can leave the group', async () => {
    const res = await request
      .post(`/groups/${groupId}/leave`)
      .send({ userId: '3' });

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('ok', true);

    const g = await fetchGroupById(groupId);
    expect(g.users || []).to.not.include('3');
  });

  // Clean up the test group so your DB stays tidy
  after(async () => {
    try {
      if (groupId) await request.delete(`/groups/${groupId}`);
    } finally {
      server.close(); // close the server started by index.js
    }
  });
});


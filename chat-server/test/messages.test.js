const { expect } = require('chai');
const supertest = require('supertest');
const { app } = require('../index');

const request = supertest(app);

describe('Messages API', () => {
  let groupId;
  let channelId;
  const creator = 'u-msg';

  it('create group + channel', async () => {
    const g = await request.post('/groups').send({ name: 'Msg Group', creatorId: creator });
    expect(g.status).to.equal(201);
    groupId = g.body.id;

    const ch = await request.post(`/groups/${groupId}/channels`).send({ name: 'general' });
    expect(ch.status).to.equal(201);
    channelId = ch.body.id;
  });

  let m1, m2, m3;

  it('post three text messages', async () => {
    const p1 = await request.post('/messages').send({
      groupId, channelId, userId: creator, username: 'alice', content: 'one'
    });
    expect(p1.status).to.equal(201); m1 = p1.body.message;

    const p2 = await request.post('/messages').send({
      groupId, channelId, userId: creator, username: 'alice', content: 'two'
    });
    expect(p2.status).to.equal(201); m2 = p2.body.message;

    const p3 = await request.post('/messages').send({
      groupId, channelId, userId: creator, username: 'alice', content: 'three'
    });
    expect(p3.status).to.equal(201); m3 = p3.body.message;

    expect(m1.timestamp).to.be.a('number');
  });

  it('GET /messages?limit=2 returns last two (oldest→newest)', async () => {
    const res = await request.get('/messages')
      .query({ groupId, channelId, limit: 2 });
    expect(res.status).to.equal(200);
    expect(res.body).to.have.length(2);
    expect(res.body[0].content).to.equal('two');
    expect(res.body[1].content).to.equal('three');
  });

  it('GET /messages before the 3rd gets first two', async () => {
    const res = await request.get('/messages')
      .query({ groupId, channelId, before: m3.timestamp, limit: 5 });
    expect(res.status).to.equal(200);
    expect(res.body.map(x => x.content)).to.deep.equal(['one','two']);
  });

  it('ban username then posting returns 403', async () => {
    // ban alice by username
    const ban = await request
      .post(`/groups/${groupId}/channels/${channelId}/ban`)
      .send({ username: 'alice', report: true });
    expect(ban.status).to.equal(200);

    const p = await request.post('/messages').send({
      groupId, channelId, userId: creator, username: 'alice', content: 'should-fail'
    });
    expect(p.status).to.equal(403);
  });
});

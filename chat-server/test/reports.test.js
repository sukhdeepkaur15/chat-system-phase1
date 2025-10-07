const { expect } = require('chai');
const supertest = require('supertest');
const { app } = require('../index');

const request = supertest(app);

describe('Reports', () => {
  let groupId; let channelId; let reportId;

  it('create group+channel', async () => {
    const g = await request.post('/groups').send({ name: 'Report Group', creatorId: 'u-rep' });
    expect(g.status).to.equal(201);
    groupId = g.body.id;

    const ch = await request.post(`/groups/${groupId}/channels`).send({ name: 'mod' });
    expect(ch.status).to.equal(201);
    channelId = ch.body.id;
  });

  it('ban with report=true creates a report', async () => {
    const r = await request
      .post(`/groups/${groupId}/channels/${channelId}/ban`)
      .send({ username: 'rulebreaker', actorUserId: 'u-rep', report: true });

    expect(r.status).to.equal(200);

    const list = await request.get('/reports');
    expect(list.status).to.equal(200);

    const found = (list.body || []).find(x =>
      x.groupId === groupId && x.channelId === channelId && x.targetUsername === 'rulebreaker' && (x.status || 'open') === 'open'
    );
    expect(found).to.exist;
    reportId = found.id;
  });

  it('resolve report sets status=resolved', async () => {
    const res = await request.put(`/reports/${reportId}/resolve`).send();
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('ok', true);
    expect(res.body.report.status).to.equal('resolved');
  });
});

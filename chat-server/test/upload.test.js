const { expect } = require('chai');
const supertest = require('supertest');
const fs = require('fs');
const path = require('path');
const { app } = require('../index');

const request = supertest(app);

// 1x1 transparent PNG
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P8/5+hHgAH0gKc7m8H9wAAAABJRU5ErkJggg==';

function writeTempPng(name) {
  const p = path.join(__dirname, name);
  fs.writeFileSync(p, Buffer.from(TINY_PNG_B64, 'base64'));
  return p;
}

describe('Upload routes', () => {
  let groupId; let channelId;

  it('create group+channel for image message', async () => {
    const g = await request.post('/groups').send({ name: 'Upload Group', creatorId: 'u-up' });
    expect(g.status).to.equal(201);
    groupId = g.body.id;

    const ch = await request.post(`/groups/${groupId}/channels`).send({ name: 'images' });
    expect(ch.status).to.equal(201);
    channelId = ch.body.id;
  });

  it('upload avatar by username (super)', async () => {
    const filePath = writeTempPng('tmp-avatar.png');
    const res = await request
      .post('/upload/avatar')
      .attach('file', filePath)
      .field('username', 'super'); // seeded in step 1
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('ok', true);
    expect(res.body.avatarUrl).to.match(/^\/uploads\/avatars\//);
  });

  it('upload chat image and creates image message + broadcast', async () => {
    const filePath = writeTempPng('tmp-chat.png');
    const res = await request
      .post('/upload/chat')
      .attach('file', filePath)
      .field('groupId', groupId)
      .field('channelId', channelId)
      .field('userId', 'u-up')
      .field('username', 'uploader')
      .field('avatarUrl', '');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('ok', true);
    expect(res.body.imageUrl).to.match(/^\/uploads\/chat\//);
    expect(res.body).to.have.property('message');
    expect(res.body.message.type).to.equal('image');
  });
});

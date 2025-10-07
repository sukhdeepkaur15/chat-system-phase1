// test/upload.test.js
const request = require('supertest');
const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const { app, server } = require('..'); // index.js exports { app, server }

describe('Upload routes', function () {
  // Will be filled by the first test
  let gid, cid;

  before(function () {
    // tiny temp files just for the form-data
    fs.writeFileSync(path.join(__dirname, 'tmp-avatar.png'), 'x');
    fs.writeFileSync(path.join(__dirname, 'tmp-chat.png'), 'y');
  });

  after(function () {
    try { server && server.close(); } catch (e) {}
  });

  it('create group+channel for image message', async function () {
    // create group
    const g = await request(app)
      .post('/groups')
      .send({ name: 'UploadSuite', creatorId: 'u-super' })
      .expect(201);

    gid = g.body.id;
    expect(gid).to.be.a('string');

    // create channel
    const ch = await request(app)
      .post(`/groups/${gid}/channels`)
      .send({ name: 'General' })
      .expect(201);

    cid = ch.body.id;
    expect(cid).to.be.a('string');
  });

  it('upload avatar by username (super)', async function () {
    const res = await request(app)
      // your router accepts /upload/avatar/:username and also /avatar/:username
      .post('/upload/avatar/super')
      .attach('avatar', Buffer.from('avatar-bytes'), 'avatar.png')
      .expect(200);

    // Route may return { url } or { imageUrl } or { avatarUrl }
    const url = res.body.url ?? res.body.imageUrl ?? res.body.avatarUrl;
    expect(url, 'response url').to.be.a('string');
    expect(url).to.match(/^\/uploads\/avatars\//);
  });

  it('upload chat image and creates image message + broadcast', async function () {
    expect(gid, 'gid from previous test').to.be.a('string');
    expect(cid, 'cid from previous test').to.be.a('string');

    const res = await request(app)
      .post('/upload/chat')
      .field('groupId', gid)
      .field('channelId', cid)
      .field('username', 'super')
      .field('userId', 'u-super')
      .attach('file', Buffer.from('chat-bytes'), 'chat.png')
      .expect(200);

    expect(res.body.ok).to.equal(true);
    expect(res.body.imageUrl).to.match(/^\/uploads\/chat\//);
    expect(res.body.message).to.be.an('object');
  });
});


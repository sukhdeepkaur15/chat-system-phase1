const { Server } = require('socket.io');
const { getDb } = require('./mongo');

module.exports = function registerSockets(server) {
  const io = new Server(server, {
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    // client sends: { groupId, channelId, userId, username }
    socket.on('joinChannel', ({ groupId, channelId, userId, username }) => {
      const room = `${groupId}:${channelId}`;
      socket.join(room);
      socket.data = { groupId, channelId, userId, username };

      io.to(room).emit('userJoined', { userId, username, ts: Date.now() });
    });

    socket.on('leaveChannel', () => {
      const { groupId, channelId, userId, username } = socket.data || {};
      if (!groupId || !channelId) return;
      const room = `${groupId}:${channelId}`;
      socket.leave(room);
      io.to(room).emit('userLeft', { userId, username, ts: Date.now() });
      socket.data = {};
    });

    // when a new message saved via REST, the client can also emit here OR
    // you can hook server-side after insertOne; simplest: let client emit:
    socket.on('message', async (msg) => {
      // msg = { groupId, channelId, userId, username, avatarUrl?, type, content?, imageUrl? }
      const db = getDb();
      msg.timestamp = Date.now();
      await db.collection('messages').insertOne(msg);
      const room = `${msg.groupId}:${msg.channelId}`;
      io.to(room).emit('message', msg);
    });

    socket.on('disconnect', () => {
      const { groupId, channelId, userId, username } = socket.data || {};
      if (groupId && channelId) {
        io.to(`${groupId}:${channelId}`).emit('userLeft', { userId, username, ts: Date.now() });
      }
    });
  });
};

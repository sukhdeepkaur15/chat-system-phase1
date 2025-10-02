const { ExpressPeerServer } = require('peer');
const express = require('express');
const http = require('http');

function startPeerServer() {
  const app = express();
  const server = http.createServer(app);

  // Internal path is '/', we mount the whole peer server at /peerjs
  const peerServer = ExpressPeerServer(server, {
    path: '/',          // <— important
    debug: true
  });

  app.use('/peerjs', peerServer); // <— mount point is /peerjs

  peerServer.on('connection', (client) => {
    console.log('[peer] client connected:', client.id);
  });

  peerServer.on('disconnect', (client) => {
    console.log('[peer] client disconnected:', client.id);
  });

  const PORT = process.env.PEER_PORT || 4001;
  server.listen(PORT, () => {
    console.log(`Peer server running at http://localhost:${PORT}/peerjs`);
  });
}

module.exports = startPeerServer;

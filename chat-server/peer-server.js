const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');

module.exports = function startPeerServer() {
  const app = express();
  const server = http.createServer(app);

  const port = Number(process.env.PEER_PORT || 4001);

  // Internal path is '/', mounted at '/peerjs' => final endpoint /peerjs/id
  const peerServer = ExpressPeerServer(server, { path: '/' });
  app.use('/peerjs', peerServer);

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`[peer] Port ${port} is in use. Skipping PeerJS startup (video calls disabled).`);
    } else {
      console.error('[peer] server error:', err);
    }
  });

  server.listen(port, () => {
    console.log(`Peer server running at http://localhost:${port}/peerjs`);
  });

  return server;
};

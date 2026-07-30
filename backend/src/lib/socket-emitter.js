'use strict';

let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

function emitGameUpdate(userId, gameState) {
  if (!ioInstance || !userId) return;
  const room = `user:${userId}`;
  ioInstance.to(room).emit('game:update', gameState);
}

module.exports = {
  setIo,
  emitGameUpdate,
};

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = window.location.origin;

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL);
  }
  return socket;
};

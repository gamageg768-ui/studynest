import { io, Socket } from "socket.io-client";

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    // Werkzeug 3.x dev server doesn't support WS upgrade; polling works fine
    _socket = io({ path: "/socket.io", transports: ["polling"] });
  }
  return _socket;
}

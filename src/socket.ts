import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket | null {
  return socket
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket

  socket = io(window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling']
  })

  socket.on('connect', () => console.log('Socket connected'))
  socket.on('disconnect', () => console.log('Socket disconnected'))

  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

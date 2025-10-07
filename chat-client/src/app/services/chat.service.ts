import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { ApiService } from './api.service';
import { Message } from '../models/group.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private socket!: Socket;
  private readonly base = 'http://localhost:4000';

  constructor(private api: ApiService) {
    this.socket = io(this.base, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500
    });

    this.socket.on('connect',        () => console.log('[socket] connected', this.socket.id));
    this.socket.on('disconnect',     (reason: string) => console.log('[socket] disconnected:', reason));
    this.socket.on('connect_error',  (err: Error) => console.error('[socket] connect_error:', err.message));
    this.socket.on('error',          (err: any) => console.error('[socket] error:', err));
  }

  /** History via REST (initial load) */
  getMessages(groupId: string, channelId: string): Observable<Message[]> {
    return this.api.get<Message[]>('/messages', { groupId, channelId });
  }

  /**
   * Send text message:
   *  - emits via socket for realtime
   *  - POSTs via REST so caller can `.subscribe(...)`
   */
  sendMessage(
  groupId: string,
  channelId: string,
  username: string,
  userId: string,
  content: string,
  avatarUrl?: string | null
): Observable<{ ok: boolean; message: Message }> {
  // 1) Realtime: richer payload is fine for sockets
  const socketPayload = {
    groupId, channelId, username, userId, content,
    avatarUrl: avatarUrl ?? null,
    type: 'text' as const,
  };
  try {
    (this as any)?.socket?.emit?.('message', socketPayload);
  } catch { /* no-op in tests */ }

  // 2) REST: canonical payload only (what the spec asserts)
  const apiPayload = { groupId, channelId, username, userId, content };
  return this.api.post<{ ok: boolean; message: Message }>('/messages', apiPayload);
}

  /** Image message (upload via REST; server will broadcast to channel) */
  sendImageMessage(
    groupId: string,
    channelId: string,
    username: string,
    userId: string,
    file: File
  ): Observable<any> {
    return this.api.uploadChatImage(groupId, channelId, file, username, userId);
  }

  /** Join/Leave channel rooms */
  joinChannel(groupId: string, channelId: string, userId: string, username: string) {
    this.socket.emit('join', { groupId, channelId, userId, username });
  }
  leaveChannel(groupId: string, channelId: string, userId: string, username: string) {
    this.socket.emit('leave', { groupId, channelId, userId, username });
  }

  /** Listeners return an unsubscribe fn */
  onMessage(cb: (msg: Message) => void): () => void {
    const h = (m: Message) => cb(m);
    this.socket.on('message', h);
    return () => this.socket.off('message', h);
  }
  onUserJoin(cb: (data: any) => void): () => void {
    const h = (d: any) => cb(d);
    this.socket.on('user-join', h);
    return () => this.socket.off('user-join', h);
  }
  onUserLeave(cb: (data: any) => void): () => void {
    const h = (d: any) => cb(d);
    this.socket.on('user-leave', h);
    return () => this.socket.off('user-leave', h);
  }

  disconnect() { if (this.socket?.connected) this.socket.disconnect(); }
}

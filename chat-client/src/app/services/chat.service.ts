// src/app/services/chat.service.ts
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { ApiService } from './api.service';
import { Message } from '../models/group.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private socket!: Socket;

  // Stream of realtime messages pushed by the server
  private messageSubject = new Subject<Message>();
  public  onMessage$    = this.messageSubject.asObservable();

  // Optional streams for presence events (use if you want)
  private joinSubject  = new Subject<{ userId: string; username: string; ts: number }>();
  private leaveSubject = new Subject<{ userId: string; username: string; ts: number }>();
  public  onUserJoined$ = this.joinSubject.asObservable();
  public  onUserLeft$   = this.leaveSubject.asObservable();

  private readonly base = 'http://localhost:4000';

  constructor(private api: ApiService) {
    // Plain default Socket.IO server (server used default path)
    this.socket = io(this.base, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
    });

    // Connection lifecycle logs
    this.socket.on('connect',       () => console.log('[socket] connected', this.socket.id));
    this.socket.on('disconnect',    (reason: string) => console.log('[socket] disconnected:', reason));
    this.socket.on('connect_error', (err: Error) => console.error('[socket] connect_error:', err.message));
    this.socket.on('error',         (err: any)   => console.error('[socket] error:', err));

    // Realtime messages from the server (server emits after persisting)
    this.socket.on('message', (msg: Message) => {
      this.messageSubject.next(msg);
    });

    // Presence events (exact names from server: userJoined / userLeft)
    this.socket.on('userJoined', (payload: any) => this.joinSubject.next(payload));
    this.socket.on('userLeft',   (payload: any) => this.leaveSubject.next(payload));

    // Backward-compat: if older names were ever used, listen too (no-op if unused)
    this.socket.on('user-join',  (payload: any) => this.joinSubject.next(payload));
    this.socket.on('user-leave', (payload: any) => this.leaveSubject.next(payload));
  }

  /** History via REST (initial load / pagination handled server-side) */
  getMessages(groupId: string, channelId: string): Observable<Message[]> {
    return this.api.get<Message[]>('/messages', { groupId, channelId });
  }

  /**
   * Send text message via REST. The server will broadcast the saved message,
   * so we DO NOT emit a socket 'message' here (prevents duplicates).
   */
  sendMessage(
    groupId: string,
    channelId: string,
    username: string,
    userId: string,
    content: string
  ) {
    const payload = { groupId, channelId, username, userId, content };
    return this.api.post<{ ok: boolean; message: Message }>('/messages', payload);
  }

  /** Image message (upload via REST; server will create & broadcast message) */
  sendImageMessage(
    groupId: string,
    channelId: string,
    username: string,
    userId: string,
    file: File
  ): Observable<any> {
    return this.api.uploadChatImage(groupId, channelId, file, username, userId);
  }

  /**
   * Join a channel room on the socket server.
   * Returns a Promise that resolves with the server ack: { ok: boolean, error?: string }
   */
  joinChannel(groupId: string, channelId: string, userId: string, username: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise(resolve => {
      this.socket.emit('joinChannel', { groupId, channelId, userId, username }, (ack: any) => {
        resolve(ack ?? { ok: true });
      });
    });
  }

  /** Leave a channel room on the socket server (also supports ack) */
  leaveChannel(groupId?: string, channelId?: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise(resolve => {
      // server accepts payload OR uses socket.data defaults; send if we have them
      const payload: any = {};
      if (groupId)  payload.groupId  = groupId;
      if (channelId) payload.channelId = channelId;

      this.socket.emit('leaveChannel', payload, (ack: any) => {
        resolve(ack ?? { ok: true });
      });
    });
  }

  /**
   * Optional convenience: callback-style subscription to messages.
   * Returns an unsubscribe function.
   */
  onMessage(cb: (msg: Message) => void): () => void {
    const sub = this.onMessage$.subscribe(cb);
    return () => sub.unsubscribe();
  }

  /** Presence listeners (callback style) */
  onUserJoin(cb: (data: any) => void): () => void {
    const sub = this.onUserJoined$.subscribe(cb);
    return () => sub.unsubscribe();
  }
  onUserLeave(cb: (data: any) => void): () => void {
    const sub = this.onUserLeft$.subscribe(cb);
    return () => sub.unsubscribe();
  }

  /** Cleanup */
  disconnect() {
    try { this.socket?.off('message'); } catch {}
    try { this.socket?.disconnect(); } catch {}
  }
}

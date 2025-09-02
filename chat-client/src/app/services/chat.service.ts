import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Message } from '../models/group.model'; // <-- use your models, not group.service

@Injectable({ providedIn: 'root' })
export class ChatService {
  constructor(private api: ApiService) {}

  /**
   * GET messages for a channel (server reads from its JSON file)
   * Assumes server exposes: GET /api/messages?groupId=...&channelId=...
   */
  getMessages(groupId: string, channelId: string): Observable<Message[]> {
    const qs = `?groupId=${encodeURIComponent(groupId)}&channelId=${encodeURIComponent(channelId)}`;
    return this.api.get<Message[]>(`/messages${qs}`);
  }

  /**
   * POST a new message
   * Body: { groupId, channelId, username, content }
   * Returns: { ok: boolean, message: Message }
   */
  sendMessage(
    groupId: string,
    channelId: string,
    username: string,
    content: string
  ): Observable<{ ok: boolean; message: Message }> {
    return this.api.post<{ ok: boolean; message: Message }>(`/messages`, {
      groupId,
      channelId,
      username,
      content,
    });
  }
}

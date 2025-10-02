import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = 'http://localhost:4000';

  constructor(private http: HttpClient) {}

  /** --- Health check --- */
  health(): Observable<any> {
    return this.http.get(`${this.base}/health`);
  }

  /** --- Groups --- */
  getGroups(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/groups`);
  }

  createGroup(name: string, creatorId: string): Observable<any> {
    return this.http.post(`${this.base}/groups`, { name, creatorId });
  }

  deleteGroup(groupId: string): Observable<any> {
    return this.http.delete(`${this.base}/groups/${groupId}`);
  }

  /** --- Channels --- */
  addChannel(groupId: string, name: string): Observable<any> {
    return this.http.post(`${this.base}/groups/${groupId}/channels`, { name });
  }

  removeChannel(groupId: string, channelId: string): Observable<any> {
    return this.http.delete(`${this.base}/groups/${groupId}/channels/${channelId}`);
  }

  /** --- Messages --- */
  getMessages(groupId: string, channelId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/messages`, {
      params: { groupId, channelId }
    });
  }

  sendMessage(groupId: string, channelId: string, username: string, userId: string, content: string): Observable<any> {
    return this.http.post(`${this.base}/messages`, {
      groupId, channelId, username, userId, content
    });
  }

  /** --- Avatars (profile images) --- */
  uploadAvatar(file: File, userId: string): Observable<any> {
    const form = new FormData();
    form.append('avatar', file);
    form.append('userId', userId);
    return this.http.post(`${this.base}/upload/avatar`, form);
  }

// --- Chat images ---
uploadChatImage(
  groupId: string,
  channelId: string,
  file: File,
  username?: string,
  userId?: string
): Observable<any> {
  const form = new FormData();
  form.append('image', file);
  form.append('groupId', groupId);
  form.append('channelId', channelId);
  if (username) form.append('username', username);
  if (userId) form.append('userId', userId);

  return this.post<any>('/upload/chat', form);
}

  /** --- Join/Leave group --- */
  joinGroup(groupId: string, userId: string): Observable<any> {
    return this.http.post(`${this.base}/groups/${groupId}/join`, { userId });
  }

  leaveGroup(groupId: string, userId: string): Observable<any> {
    return this.http.post(`${this.base}/groups/${groupId}/leave`, { userId });
  }

  approveJoin(groupId: string, userId: string): Observable<any> {
    return this.http.put(`${this.base}/groups/${groupId}/approve/${userId}`, {});
  }

  rejectJoin(groupId: string, userId: string): Observable<any> {
    return this.http.put(`${this.base}/groups/${groupId}/reject/${userId}`, {});
  }

  /** --- Bans --- */
  banUser(groupId: string, channelId: string, body: { userId?: string; username?: string; actorUserId?: string; report?: boolean }): Observable<any> {
    return this.http.post(`${this.base}/groups/${groupId}/channels/${channelId}/ban`, body);
  }

  unbanUser(groupId: string, channelId: string, body: { userId?: string; username?: string }): Observable<any> {
    return this.http.request('DELETE', `${this.base}/groups/${groupId}/channels/${channelId}/ban`, { body });
  }

  getBanned(groupId: string, channelId: string): Observable<any> {
    return this.http.get(`${this.base}/groups/${groupId}/channels/${channelId}/banned`);
  }

  /** --- Generic helpers (kept for flexibility) --- */
  get<T>(path: string, params?: Record<string, any>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) httpParams = httpParams.set(k, String(v));
      }
    }
    return this.http.get<T>(`${this.base}${path}`, { params: httpParams });
  }

  post<T>(path: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, body);
  }

  put<T>(path: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.base}${path}`, body);
  }

  delete<T>(path: string, options: { body?: any; params?: Record<string, any> } = {}): Observable<T> {
    let httpParams = new HttpParams();
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== null) httpParams = httpParams.set(k, String(v));
      }
    }

    return this.http.request<T>('DELETE', `${this.base}${path}`, {
      body: options.body,
      params: httpParams,
      observe: 'body'
    });
  }
}


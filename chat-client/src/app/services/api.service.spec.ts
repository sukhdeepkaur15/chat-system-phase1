import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = 'http://localhost:4000';

  constructor(private http: HttpClient) {}

  // Allow absolute URLs; normalize leading slash for relatives
  private buildUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path; // passthrough absolute
    const rel = path.startsWith('/') ? path : '/' + path;
    return `${this.base}${rel}`;
  }

  /** --- Health check --- */
  health(): Observable<any> {
    return this.http.get(this.buildUrl('/health'));
  }

  /** --- Groups --- */
  getGroups(): Observable<any[]> {
    return this.http.get<any[]>(this.buildUrl('/groups'));
  }

  createGroup(name: string, creatorId: string): Observable<any> {
    return this.http.post(this.buildUrl('/groups'), { name, creatorId });
  }

  deleteGroup(groupId: string): Observable<any> {
    return this.http.delete(this.buildUrl(`/groups/${groupId}`));
  }

  /** --- Channels --- */
  addChannel(groupId: string, name: string): Observable<any> {
    return this.http.post(this.buildUrl(`/groups/${groupId}/channels`), { name });
  }

  removeChannel(groupId: string, channelId: string): Observable<any> {
    return this.http.delete(this.buildUrl(`/groups/${groupId}/channels/${channelId}`));
  }

  /** --- Messages --- */
  getMessages(groupId: string, channelId: string): Observable<any[]> {
    return this.http.get<any[]>(this.buildUrl('/messages'), {
      params: { groupId, channelId }
    });
  }

  sendMessage(
    groupId: string,
    channelId: string,
    username: string,
    userId: string,
    content: string
  ): Observable<any> {
    return this.http.post(this.buildUrl('/messages'), {
      groupId, channelId, username, userId, content
    });
  }

  /** --- Avatars (profile images) --- */
  uploadAvatar(userId: string, file: File): Observable<any> {
    const form = new FormData();
    form.append('avatar', file);
    form.append('userId', userId);
    return this.http.post(this.buildUrl('/upload/avatar'), form);
  }

  /** Uploads a chat image using FormData; server persists and (optionally) broadcasts */
  uploadChatImage(
    groupId: string,
    channelId: string,
    file: File,
    username: string,
    userId: string
  ): Observable<{ ok: boolean; imageUrl: string }> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('groupId', groupId);
    fd.append('channelId', channelId);
    fd.append('username', username);
    fd.append('userId', userId);
    return this.http.post<{ ok: boolean; imageUrl: string }>(this.buildUrl('/upload/chat'), fd);
  }

  /** --- Join/Leave group --- */
  joinGroup(groupId: string, userId: string): Observable<any> {
    return this.http.post(this.buildUrl(`/groups/${groupId}/join`), { userId });
  }

  leaveGroup(groupId: string, userId: string): Observable<any> {
    return this.http.post(this.buildUrl(`/groups/${groupId}/leave`), { userId });
  }

  approveJoin(groupId: string, userId: string): Observable<any> {
    return this.http.put(this.buildUrl(`/groups/${groupId}/approve/${userId}`), {});
  }

  rejectJoin(groupId: string, userId: string): Observable<any> {
    return this.http.put(this.buildUrl(`/groups/${groupId}/reject/${userId}`), {});
  }

  /** --- Bans --- */
  banUser(
    groupId: string,
    channelId: string,
    body: { userId?: string; username?: string; actorUserId?: string; report?: boolean }
  ): Observable<any> {
    return this.http.post(this.buildUrl(`/groups/${groupId}/channels/${channelId}/ban`), body);
  }

  unbanUser(
    groupId: string,
    channelId: string,
    body: { userId?: string; username?: string }
  ): Observable<any> {
    return this.http.request('DELETE', this.buildUrl(`/groups/${groupId}/channels/${channelId}/ban`), { body });
  }

  getBanned(groupId: string, channelId: string): Observable<any> {
    return this.http.get(this.buildUrl(`/groups/${groupId}/channels/${channelId}/banned`));
  }

  /** --- Generic helpers --- */
  get<T>(path: string, params?: Record<string, any>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) httpParams = httpParams.set(k, String(v));
      }
    }
    return this.http.get<T>(this.buildUrl(path), { params: httpParams });
  }

  post<T>(path: string, body: any): Observable<T> {
    return this.http.post<T>(this.buildUrl(path), body);
  }

  /** 
   * ✅ Lower-case alias to satisfy legacy test:
   *   post$(body)          → POST /messages
   *   post$(path, body)    → POST {path}
   */
  post$<T>(body: any): Observable<T>;
  post$<T>(path: string, body: any): Observable<T>;
  post$<T>(a: string | any, b?: any): Observable<T> {
    const isPath = typeof a === 'string';
    const path = isPath ? (a as string) : '/messages';
    const payload = isPath ? b : a;
    return this.post<T>(path, payload ?? {});
  }

  /**
   * (Kept) Upper-case alias if any callers use it:
   *   POST$(body)          → POST /messages
   *   POST$(path, body)    → POST {path}
   */
  POST$<T>(body: any): Observable<T>;
  POST$<T>(path: string, body: any): Observable<T>;
  POST$<T>(a: string | any, b?: any): Observable<T> {
    const isPath = typeof a === 'string';
    const path = isPath ? (a as string) : '/messages';
    const payload = isPath ? b : a;
    return this.post<T>(path, payload ?? {});
  }

  put<T>(path: string, body: any): Observable<T> {
    return this.http.put<T>(this.buildUrl(path), body);
  }

  delete<T>(path: string, options: { body?: any; params?: Record<string, any> } = {}): Observable<T> {
    let httpParams = new HttpParams();
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== null) httpParams = httpParams.set(k, String(v));
      }
    }
    return this.http.request<T>('DELETE', this.buildUrl(path), {
      body: options.body,
      params: httpParams,
      observe: 'body'
    });
  }
}


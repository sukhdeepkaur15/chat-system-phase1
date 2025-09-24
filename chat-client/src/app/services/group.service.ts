import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Group, Channel } from '../models/group.model'; // Message is inside channels

@Injectable({ providedIn: 'root' })
export class GroupService {
  /** Optional local cache so components can inspect after a fetch */
  public groupsCache: Group[] = [];

  constructor(private api: ApiService) {}

  /** ---- GROUPS ---- */

  /** Get all groups */
  getGroups(): Observable<Group[]> {
    return this.api.get<Group[]>('/groups').pipe(
      tap(gs => (this.groupsCache = gs || []))
    );
  }

  /** Create a group */
  createGroup(name: string, creatorId: string): Observable<Group> {
    return this.api.post<Group>('/groups', { name, creatorId }).pipe(
      tap(g => {
        if (g) this.groupsCache = [...this.groupsCache, g];
      })
    );
  }

  /** Delete a group (server enforces permissions) */
  deleteGroup(groupId: string): Observable<{ ok: boolean }> {
    return this.api.delete<{ ok: boolean }>(`/groups/${groupId}`).pipe(
      tap(res => {
        if (res?.ok) {
          this.groupsCache = this.groupsCache.filter(g => g.id !== groupId);
        }
      })
    );
  }

  /** User leaves a group */
  leaveGroup(groupId: string, userId: string): Observable<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>(`/groups/${groupId}/leave`, { userId }).pipe(
      tap(res => {
        if (res?.ok) {
          const g = this.groupsCache.find(x => x.id === groupId);
          if (g) {
            g.users = (g.users || []).filter(id => id !== userId);
            g.channels = (g.channels || []).map(ch => ({
              ...ch,
              members: (ch.members || []).filter(id => id !== userId),
            }));
          }
        }
      })
    );
  }

  /** ---- CHANNELS ---- */

  /** Create a channel within a group */
  createChannel(groupId: string, name: string): Observable<Channel> {
    return this.api.post<Channel>(`/groups/${groupId}/channels`, { name }).pipe(
      tap(ch => {
        const g = this.groupsCache.find(x => x.id === groupId);
        if (g && ch) g.channels = [...(g.channels || []), ch];
      })
    );
  }

  /** Remove a channel */
  removeChannel(groupId: string, channelId: string): Observable<{ ok: boolean }> {
    return this.api.delete<{ ok: boolean }>(`/groups/${groupId}/channels/${channelId}`).pipe(
      tap(res => {
        if (res?.ok) {
          const g = this.groupsCache.find(x => x.id === groupId);
          if (g) g.channels = (g.channels || []).filter(c => c.id !== channelId);
        }
      })
    );
  }

  /** ---- MEMBERSHIP / REQUESTS ---- */

  /** Request to join a group */
  requestToJoin(groupId: string, userId: string): Observable<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>(`/groups/${groupId}/join`, { userId }).pipe(
      tap(res => {
        if (res?.ok) {
          const g = this.groupsCache.find(x => x.id === groupId);
          if (g) {
            g.joinRequests = g.joinRequests || [];
            if (!g.joinRequests.includes(userId)) g.joinRequests.push(userId);
          }
        }
      })
    );
  }

  /** Approve a join request */
  approveJoinRequest(groupId: string, userId: string): Observable<Group> {
    return this.api.put<Group>(`/groups/${groupId}/approve/${userId}`, {}).pipe(
      tap(updated => {
        // trust server state; replace in cache
        if (!updated) return;
        this.groupsCache = this.groupsCache.map(g => (g.id === groupId ? updated : g));
      })
    );
  }

  /** Reject a join request */
  rejectJoinRequest(groupId: string, userId: string): Observable<Group> {
    return this.api.put<Group>(`/groups/${groupId}/reject/${userId}`, {}).pipe(
      tap(updated => {
        if (!updated) return;
        this.groupsCache = this.groupsCache.map(g => (g.id === groupId ? updated : g));
      })
    );
  }
}

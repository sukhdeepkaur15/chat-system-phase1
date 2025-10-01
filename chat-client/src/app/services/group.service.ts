// src/app/services/group.service.ts
import { Injectable } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Group, Channel } from '../models/group.model'; // Message is inside channels

/** ===== Moderation reports (Phase 1: in-memory) ===== */
export interface ModerationReport {
  id: string;
  groupId: string;
  channelId?: string;
  userId?: string;
  username?: string;
  actorUserId: string;
  actorUsername: string;
  reason?: string;
  createdAt: string;
  resolved?: boolean;
}

@Injectable({ providedIn: 'root' })
export class GroupService {
  /** Optional local cache so components can inspect after a fetch */
  public groupsCache: Group[] = [];

  /** In-memory moderation reports (super admins can read & resolve) */
  private reports: ModerationReport[] = [];

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

  /** Delete a group */
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

  approveJoinRequest(groupId: string, userId: string): Observable<Group> {
    return this.api.put<Group>(`/groups/${groupId}/approve/${userId}`, {}).pipe(
      tap(updated => {
        if (!updated) return;
        this.groupsCache = this.groupsCache.map(g => (g.id === groupId ? updated : g));
      })
    );
  }

  rejectJoinRequest(groupId: string, userId: string): Observable<Group> {
    return this.api.put<Group>(`/groups/${groupId}/reject/${userId}`, {}).pipe(
      tap(updated => {
        if (!updated) return;
        this.groupsCache = this.groupsCache.map(g => (g.id === groupId ? updated : g));
      })
    );
  }

  /** ---- BANS (channel scope ONLY) ---- */

  banUserInChannel(
    groupId: string,
    channelId: string,
    userId?: string,
    username?: string
  ): Observable<{ ok: boolean; channel?: any }> {
    return this.api.post<{ ok: boolean; channel?: any }>(
      `/groups/${groupId}/channels/${channelId}/ban`,
      { userId, username }
    ).pipe(
      tap(res => {
        if (!res?.ok) return;
        const g = this.groupsCache.find(x => x.id === groupId);
        const c = g?.channels?.find(x => x.id === channelId);
        if (c) {
          (c as any).bannedUserIds = (c as any).bannedUserIds || [];
          (c as any).bannedUsernames = (c as any).bannedUsernames || [];
          if (userId && !(c as any).bannedUserIds.includes(userId)) {
            (c as any).bannedUserIds.push(userId);
            c.members = (c.members || []).filter(id => id !== userId);
          }
          if (username && !(c as any).bannedUsernames.includes(username)) {
            (c as any).bannedUsernames.push(username);
          }
        }
      })
    );
  }

  unbanUserInChannel(
    groupId: string,
    channelId: string,
    userId?: string,
    username?: string
  ): Observable<{ ok: boolean; channel?: any }> {
    return this.api.delete<{ ok: boolean; channel?: any }>(
      `/groups/${groupId}/channels/${channelId}/ban`,
      { body: { userId, username } }
    ).pipe(
      tap(res => {
        if (!res?.ok) return;
        const g = this.groupsCache.find(x => x.id === groupId);
        const c = g?.channels?.find(x => x.id === channelId);
        if (c) {
          (c as any).bannedUserIds = ((c as any).bannedUserIds || []).filter((id: string) => id !== userId);
          (c as any).bannedUsernames = ((c as any).bannedUsernames || []).filter((u: string) => u !== username);
        }
      })
    );
  }

  listBanned(
    groupId: string,
    channelId: string
  ): Observable<{ bannedUserIds: string[]; bannedUsernames: string[] }> {
    return this.api.get<{ bannedUserIds: string[]; bannedUsernames: string[] }>(
      `/groups/${groupId}/channels/${channelId}/banned`
    );
  }

  /** ---- MODERATION REPORTS (Phase 1, no server) ---- */

  /**
   * Group admins call this to report to super admins.
   * Pass whatever you have; id/createdAt/resolved are auto-filled.
   */
  reportToSuper(report: {
    groupId: string;
    channelId?: string;
    userId?: string;
    username?: string;
    actorUserId: string;
    actorUsername: string;
    reason?: string;
  }): Observable<{ ok: boolean }> {
    const id = 'r_' + Math.random().toString(36).slice(2, 10);
    const rec: ModerationReport = {
      id,
      createdAt: new Date().toISOString(),
      resolved: false,
      ...report,
    };
    this.reports.push(rec);
    return of({ ok: true });
  }

  /** Super admins load open reports */
  getReports(): Observable<ModerationReport[]> {
    return of(this.reports.filter(r => !r.resolved));
  }

  /** Super admins resolve a report */
  resolveReport(reportId: string): Observable<{ ok: boolean }> {
    const r = this.reports.find(x => x.id === reportId);
    if (r) r.resolved = true;
    return of({ ok: true });
  }
}





// src/app/services/group.service.ts
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Group, Channel } from '../models/group.model'; // Message is inside channels

/** ===== Moderation reports (Phase 1: in-memory) ===== */
export interface ModerationReport {
  id: string;
  groupId: string;
  channelId?: string;
  userId?: string;
  username?: string;
  targetUserId?: string;
  targetUsername?: string;
  status?: 'open' | 'resolved';
  groupName?: string;
  channelName?: string;
  actorUserId: string;
  actorUsername: string;
  reason?: string;
  createdAt: string;
  resolved?: boolean;
}

/* raw server shape (what /reports returns) */
export type ServerReportRaw = {
  _id?: string;          // Mongo ObjectId
  id?: string;           // our UUID
  groupId: string;
  channelId?: string;
  targetUserId?: string;
  targetUsername?: string;
  actorUserId?: string;
  reason?: string;
  status?: 'open' | 'resolved';
  createdAt?: number | string; // epoch ms or ISO
};

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
    username?: string,
    actorUserId?: string,
    actorUsername?: string,
  ) {
    return this.api.post<{ ok: boolean; channel: any }>(
      `/groups/${groupId}/channels/${channelId}/ban`,
      {
        userId: userId || undefined,
        username: username || undefined,
        actorUserId: actorUserId || undefined,
        actorUsername: actorUsername || undefined,
        report: true
      }
    );
  }

unbanUserInChannel(
  groupId: string,
  channelId: string,
  userId?: string,
  username?: string
) {
  return this.api.delete<{ ok: boolean; channel: any }>(
    `/groups/${groupId}/channels/${channelId}/ban`,
    { body: { userId, username } }
  );
}

  /** ---- MODERATION REPORTS (Phase 1, no server) ---- */

  /** Map server report -> UI report, enrich names if we can */
  private toUiReport = (r: ServerReportRaw): ModerationReport => {
    const id = String(r.id ?? r._id ?? '');
    const created = typeof r.createdAt === 'number'
      ? new Date(r.createdAt)
      : r?.createdAt
        ? new Date(r.createdAt)
        : new Date();

    // try to enrich with names from groupsCache (best effort)
    let groupName: string | undefined;
    let channelName: string | undefined;
    const g = this.groupsCache.find(x => x.id === r.groupId);
    if (g) {
      groupName = g.name;
      const ch = (g.channels || []).find(c => c.id === r.channelId);
      channelName = ch?.name;
    }

    return {
      id,
      groupId: r.groupId,
      channelId: r.channelId,
      // keep both pairs for template compatibility
      userId: r.targetUserId,
      username: r.targetUsername,
      targetUserId: r.targetUserId,
      targetUsername: r.targetUsername,
      status: r.status || 'open',
      groupName,
      channelName,
      actorUserId: r.actorUserId || '',
      actorUsername: (r as any).actorUsername || '',
      reason: r.reason,
      createdAt: created.toISOString(),
      resolved: (r.status || 'open') === 'resolved',
    };
  }
  
  /** Super admins load open reports */
  getReports(): Observable<ModerationReport[]> {
    return this.api.get<ServerReportRaw[]>('/reports').pipe(
      map(arr => (arr || []).map(this.toUiReport).filter(r => !r.resolved)), // 🔁 CHANGED: server-backed
      catchError(() => of([])) // graceful fallback
    );
  }

  /** Super admins resolve a report on server */
  resolveReport(reportId: string): Observable<{ ok: boolean }> {
    return this.api.put<{ ok: boolean; report?: ServerReportRaw }>(`/reports/${reportId}/resolve`, {}).pipe(
      map(res => ({ ok: !!res?.ok })), ///server-backed
      catchError(() => of({ ok: false }))
    );
  }

  /** ---- (Legacy) In-memory helpers kept for completeness ---- */

  /**
   * Group admins call this to report to super admins (legacy/offline).
   * Kept as a fallback; production path uses server via banUserInChannel(report:true).
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
      groupId: report.groupId,
      channelId: report.channelId,
      userId: report.userId,
      username: report.username,
      targetUserId: report.userId,
      targetUsername: report.username,
      actorUserId: report.actorUserId,
      actorUsername: report.actorUsername,
      reason: report.reason
    };
    this.reports.push(rec);
    return of({ ok: true });
  }
}





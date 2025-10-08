// src/app/dashboard/dashboard.component.ts
import { Component, ElementRef, OnInit, NgZone, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import Peer, { MediaConnection } from 'peerjs';

import { AuthService } from '../services/auth.service';
import { GroupService } from '../services/group.service';
import { ChatService } from '../services/chat.service';
import { ApiService } from '../services/api.service';

import { User } from '../models/user.model';
import { Group, Channel, Message } from '../models/group.model';

type ChatMsg = Message & {
  avatarUrl?: string;
  imageUrl?: string;
  type?: 'text' | 'image';
};
type UIUser = User & { avatarUrl?: string | null };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  username = '';
  role: string[] = [];
  currentUser!: UIUser;

  groups: Group[] = [];
  selectedGroup: Group | null = null;
  selectedChannel: Channel | null = null;
  messages: ChatMsg[] = [];
  newMessage = '';

  // Super admin user management
  allUsers: User[] = [];
  newUsername = '';
  newEmail = '';
  newRole: 'user' | 'groupAdmin' | 'super' = 'user';

  reports: any[] = [];

  /** ---------- Video chat refs ---------- */
  @ViewChild('localVideo',  { static: true })  localVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo', { static: true })  remoteVideoRef!: ElementRef<HTMLVideoElement>;
  
  /** ---------- PeerJS state ---------- */
  peer?: Peer;
  currentCall?: MediaConnection;
  myPeerId = '';
  remotePeerId = '';
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  inCall = false;
  startingVideo = false;
   
  private socketSub?: Subscription;
  private room?: { groupId: string; channelId: string };
  private offMsg?: () => void;

  // Used by the template to enable the Start Video button
  joined = false;

  constructor(
    private authService: AuthService,
    private groupService: GroupService,
    private chatService: ChatService,
    private api: ApiService,
    private router: Router,
    private zone: NgZone,
  ) {}

  /** ---------- Lifecycle ---------- */
  ngOnInit() {
    const user = this.authService.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.currentUser = user;
    this.username = user.username;
    this.role = user.roles || [];

    this.refreshGroups();
    if (this.isSuper) {
      this.allUsers = this.authService.getAllUsers();
      this.loadReports();
    }

    // IMPORTANT: do NOT init Peer here. We only create it when user clicks Start Video Chat.
    // This avoids the unhandled error crash if the peer server isn’t reachable.
    this.socketSub = this.chatService.onMessage$.subscribe((msg: any) => {
  if (!this.selectedGroup || !this.selectedChannel) return;
  if (msg.groupId !== this.selectedGroup.id || msg.channelId !== this.selectedChannel.id) return;

  // Ignore echo of our own message (we already updated optimistically + via REST)
  if (msg.userId === this.currentUser.id) return;

  this.messages = [...(this.messages || []), msg];
 });
}

  ngOnDestroy(): void {
    try {
    if (this.selectedGroup && this.selectedChannel) {
      this.chatService.leaveChannel(this.selectedGroup.id, this.selectedChannel.id);
    }
  } catch {}
  this.socketSub?.unsubscribe();
    this.endCall(true);
    try { this.peer?.destroy(); } catch {}
    this.peer = undefined;
  }

  /** ---------- Role helpers ---------- */
  get isSuper(): boolean {
    const r = this.role || [];
    return r.includes('super') || r.includes('superAdmin');
  }
  get isGroupAdmin(): boolean {
    const r = this.role || [];
    return r.includes('groupAdmin');
  }

  isMember(group: any): boolean {
    return Array.isArray(group?.users) ? group.users.includes(this.currentUserId) : false;
  }
  hasRequested(group: any): boolean {
    return Array.isArray(group?.joinRequests) ? group.joinRequests.includes(this.currentUserId) : false;
  }
  canModerate(group: any): boolean {
    if (!group) return false;
    if (this.isSuper) return true;
    return this.isGroupAdmin && group.creatorId === this.currentUserId;
  }

  get isBannedHere(): boolean {
    if (!this.selectedGroup || !this.selectedChannel) return false;
    const byIdChan   = (this.selectedChannel.bannedUsers || []).includes(this.currentUserId);
    const byNameChan = (this.selectedChannel as any).bannedUsernames?.includes(this.username) || false;
    return byIdChan || byNameChan;
  }

  get currentUserId(): string { return this.currentUser?.id ?? ''; }
  get roleDisplay(): string { return (this.role || []).join(', '); }
  get greetingTitle(): string {
    if (this.isSuper) return 'Super Admin';
    if (this.isGroupAdmin) return 'Group Admin';
    return 'User';
  }

  trackById(_: number, item: { id: string }) { return item.id; }

  get visibleChannels(): Channel[] {
    if (!this.selectedGroup) return [];
    const g = this.selectedGroup;
    if (this.isSuper) return g.channels || [];
    return (g.channels || []).filter(ch =>
      !(ch.bannedUsers || []).includes(this.currentUserId) &&
      (ch.members || []).includes(this.currentUserId)
    );
  }

  /** ---------- Data ---------- */
  private loadGroups(): void {
    this.groupService.getGroups().subscribe({
      next: (allGroups) => {
        this.groups = allGroups || [];
        if (this.selectedGroup) {
          this.selectedGroup = this.groups.find(g => g.id === this.selectedGroup!.id) ?? null;
        }
        if (this.selectedGroup && this.selectedChannel) {
          this.selectedChannel =
            (this.selectedGroup.channels || []).find(c => c.id === this.selectedChannel!.id) ?? null;
          if (this.selectedGroup && this.selectedChannel) {
            this.loadMessages(this.selectedGroup.id, this.selectedChannel.id);
          } else {
            this.messages = [];
          }
        }
      },
      error: () => {
        this.groups = [];
        this.selectedGroup = null;
        this.selectedChannel = null;
        this.messages = [];
        this.joined = false;
      }
    });
  }
  private refreshGroups(): void { this.loadGroups(); }

  /** ---------- Reports (Super Admin) ---------- */
  loadReports() {
    if (!this.isSuper) return;
    this.groupService.getReports().subscribe({
      next: r => this.reports = r || [],
      error: () => this.reports = []
    });
  }
  resolveReport(r: any) {
    if (!this.isSuper) return;
    this.groupService.resolveReport(r.id).subscribe({
      next: () => this.loadReports()
    });
  }

  /** ---------- Auth ---------- */
  async logout() {
    await this.leaveCurrentRoom();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

/** Leave the current socket room and stop realtime listener */
private async leaveCurrentRoom(): Promise<void> {
  try {
    if (this.room) {
      const { groupId, channelId } = this.room;
      await this.chatService.leaveChannel(groupId, channelId).catch(() => {});
      this.room = undefined;
    }
  } finally {
    if (this.offMsg) {
      try { this.offMsg(); } catch {}
      this.offMsg = undefined;
    }
    this.joined = false;
  }
}

/** ---------- Selection ---------- */
async selectGroup(group: Group) {
  // Leave any previously joined channel room
  await this.leaveCurrentRoom();

  this.selectedGroup = this.groups.find(g => g.id === group.id) ?? group;
  this.selectedChannel = null;
  this.messages = [];
  this.joined = false;
}

async selectChannel(channel: Channel) {
  if (!this.selectedGroup) return;

  const isChanBanned = (channel.bannedUsers || []).includes(this.currentUserId);
  const isMember     = (channel.members || []).includes(this.currentUserId);
  if (!this.isSuper && (isChanBanned || !isMember)) {
    alert('You are not allowed to access this channel.');
    return;
  }

  // If switching channels, leave the old room & stop old listener
  await this.leaveCurrentRoom();

  // Select & load history first (REST is source of truth)
  this.selectedChannel = channel;
  const gid = this.selectedGroup.id;
  const cid = channel.id;
  this.loadMessages(gid, cid);

  // Join the socket room for realtime messages
  const ack = await this.chatService.joinChannel(gid, cid, this.currentUser.id, this.username);
  if (!ack?.ok) {
    console.warn('[joinChannel] failed:', ack?.error);
    this.joined = false;
    return;
  }

  // Mark joined and remember the room
  this.room = { groupId: gid, channelId: cid };
  this.joined = true;

  // Start realtime subscription for ONLY this channel
  this.offMsg = this.chatService.onMessage((m: any) => {
    if (m?.groupId === gid && m?.channelId === cid) {
      this.messages = [...(this.messages || []), m];
    }
  });
}

private loadMessages(groupId: string, channelId: string) {
  this.chatService.getMessages(groupId, channelId).subscribe({
    next: (msgs) => { this.messages = (msgs || []) as ChatMsg[]; },
    error: () => { this.messages = []; }
  });
}


  /** ---------- Messaging ---------- */
  sendMessage() {
    if (!this.selectedGroup || !this.selectedChannel) return;

    const text = (this.newMessage || '').trim();
    if (!text) return;

    const isChanBanned = (this.selectedChannel.bannedUsers || []).includes(this.currentUserId);
    const isMember     = (this.selectedChannel.members || []).includes(this.currentUserId);
    if (!this.isSuper && (isChanBanned || !isMember)) {
      alert('You are not allowed to post in this channel.');
      return;
    }

    const gid   = this.selectedGroup.id;
    const cid   = this.selectedChannel.id;
    const uname = this.username;
    const uid   = this.currentUser.id;

    const optimisticId = 'opt_' + Math.random().toString(36).slice(2, 10);
    const optimisticMsg: any = {
      username: uname,
      content: text,
      timestamp: Date.now(),
      __optimistic: true,
      __optimisticId: optimisticId
    };
    this.messages = [...(this.messages || []), optimisticMsg];
    this.newMessage = '';

    this.chatService
      .sendMessage(gid, cid, uname, uid, text)
      .subscribe({
        next: (res: any) => {
          if (res?.ok && res.message) {
            this.messages = (this.messages || []).map(m =>
              (m as any).__optimisticId === optimisticId ? res.message : m
            );
          }
          this.loadMessages(gid, cid);
        },
        error: (err: any) => {
          this.messages = (this.messages || []).filter(
            m => (m as any).__optimisticId !== optimisticId
          );
          if (err?.status === 403) {
            alert(err?.error?.error || 'You are banned from this channel.');
          } else {
            alert('Failed to send message. Please try again.');
          }
        }
      });
  }

  /** ---------- Avatar upload ---------- */
  uploadAvatar(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    this.api.uploadAvatar(this.currentUserId, file).subscribe({
      next: (res) => {
        const url = (res as any)?.avatarUrl || (res as any)?.url || (res as any)?.imageUrl;
        if (!url) { alert('Upload succeeded but no URL returned.'); return; }

        (this.currentUser as any).avatarUrl = url;
        this.authService.updateAvatar(this.currentUserId, url);
        if (input) input.value = '';
        alert('Avatar uploaded successfully.');
      },
      error: () => {
        alert('Failed to upload avatar.');
        if (input) input.value = '';
      }
    });
  }

  /** ---------- Upload & send image ---------- */
  sendImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file || !this.selectedGroup || !this.selectedChannel) return;

    const gid = this.selectedGroup.id;
    const cid = this.selectedChannel.id;

    this.chatService
      .sendImageMessage(gid, cid, this.username, this.currentUser.id, file)
      .subscribe({
        next: (res: any) => {
          if (res?.ok && res.imageUrl) {
            const imgMsg: ChatMsg = {
              username: this.username,
              content: '',
              imageUrl: res.imageUrl,
              timestamp: Date.now(),
              type: 'image'
            };
            this.messages = [...(this.messages || []), imgMsg];
          }
          this.loadMessages(gid, cid);
        },
        error: (err: any) => console.error(err)
      });
  }

  // =======================
  // PeerJS helpers
  // =======================

private ensurePeer(): void {
  if (this.peer && !(this.peer as any).destroyed) return;

  try {
    // IMPORTANT: options-only constructor; do NOT pass `undefined` as the first arg
    this.peer = new Peer({
      host: window.location.hostname || 'localhost',
      port: 4001,
      path: '/peerjs',                       // must be exactly this
      secure: window.location.protocol === 'https:',
      debug: 2
    });

    this.peer.on('open', (id: string) => {
      this.zone.run(() => {
        this.myPeerId = id;
        console.log('[peer] open -> id:', id);
      });
    });

    this.peer.on('disconnected', () => {
      console.warn('[peer] disconnected');
    });

    this.peer.on('close', () => {
      console.warn('[peer] close');
    });

    this.peer.on('error', (err: any) => {
      console.warn('[peer] error', err);
    });

    // Incoming calls
    this.peer.on('call', (call: MediaConnection) => {
      console.log('[peer] incoming call from', call.peer);
      try { this.currentCall?.close(); } catch {}
      this.currentCall = call;

      call.on('stream', s => this.attachRemote(s));
      call.on('close',  () => { this.attachRemote(null); this.inCall = false; });
      call.on('error',  e => console.error('[call] error', e));

      call.answer(this.localStream || undefined);
      this.inCall = true;
    });
  } catch (e) {
    console.warn('[peer] failed to construct Peer', e);
  }
}

  /** Start local camera/mic and display in the "Me" tile; also creates Peer */
  async startVideoChat() {
    if (this.startingVideo) return;
    this.startingVideo = true;
    try {
      if (!this.localStream) {
        this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        this.attachLocal(this.localStream);
      }
      this.ensurePeer();
      if (this.peer?.id && !this.myPeerId) this.myPeerId = this.peer.id;
    } catch (e) {
      alert('Could not start video (camera/mic permission or device busy). Close other apps and try again.');
      console.error('[getUserMedia error]', e);
    } finally {
      this.startingVideo = false;
    }
  }

  /** Place an outgoing call to the entered remote ID */
  callPeer() {
    if (!this.remotePeerId) { alert('Enter Remote Peer ID'); return; }
    this.ensurePeer();
    if (!this.localStream) { alert('Click "Start Video Chat" first.'); return; }

    const call = this.peer!.call(this.remotePeerId, this.localStream);
    if (!call) { alert('Failed to start call'); return; }

    try { this.currentCall?.close(); } catch {}
    this.currentCall = call;

    call.on('stream', s => this.attachRemote(s));
    call.on('close',  () => { this.attachRemote(null); this.inCall = false; });
    call.on('error',  e => console.error('[call] error', e));

    this.inCall = true;
  }

/** Utility: stop all tracks of a stream (safe) */
private stopStream(stream?: MediaStream | null) {
  try {
    stream?.getTracks()?.forEach(t => {
      try { t.stop(); } catch {}
    });
  } catch {}
}

/** Close any lingering PeerJS connections (media + data) */
private closeAllPeerConnections(): void {
  if (!this.peer) return;
  const conns = (this.peer as any).connections as Record<string, any[]> | undefined;
  if (!conns) return;
  Object.values(conns).forEach(list => {
    list?.forEach(c => { try { c.close?.(); } catch {} });
  });
}

/** Pause & clear a <video> element */
private pauseAndClearVideo(ref?: ElementRef<HTMLVideoElement>) {
  const v = ref?.nativeElement;
  if (!v) return;
  try { v.pause(); } catch {}
  try { (v as any).srcObject = null; } catch {}
  try { v.removeAttribute('src'); } catch {}
  try { v.load?.(); } catch {}
}

/// Template aliases (keep these names for your HTML)
callRemote() { this.callPeer(); }
endVideoChat() { this.endCall(); }

/** End call; optionally keep camera running */
endCall(keepLocal = false) {
  // 1) Close active call (local side)
  try { this.currentCall?.close(); } catch {}
  this.currentCall = undefined;

  // 2) Close any other stray PeerJS connections
  this.closeAllPeerConnections();

  // 3) Stop and clear REMOTE stream & video immediately
  this.stopStream(this.remoteStream);
  this.remoteStream = undefined;
  this.pauseAndClearVideo(this.remoteVideoRef);

  // 4) Stop and clear LOCAL stream if requested
  if (!keepLocal) {
    this.stopStream(this.localStream);
    this.localStream = undefined;
    this.pauseAndClearVideo(this.localVideoRef);
  }

  // 5) Mark state
  this.inCall = false;

  // 6) Safety: drop socket transport so nothing reattaches unexpectedly.
  // (You can still call again; ensurePeer() will reconnect/create as needed.)
  try { this.peer?.disconnect(); } catch {}
}

/** Attach/detach local media to the local <video> */
private attachLocal(stream: MediaStream | null) {
  this.localStream = stream ?? undefined;
  const v = this.localVideoRef?.nativeElement;
  if (!v) return;
  if (stream) {
    (v as any).srcObject = stream;
    v.muted = true;
    v.play().catch(() => {});
  } else {
    this.pauseAndClearVideo(this.localVideoRef);
  }
}

/** Attach/detach remote media to the remote <video> */
private attachRemote(stream: MediaStream | null) {
  this.remoteStream = stream ?? undefined;
  const v = this.remoteVideoRef?.nativeElement;
  if (!v) return;
  if (stream) {
    (v as any).srcObject = stream;
    v.play().catch(() => {});
  } else {
    this.pauseAndClearVideo(this.remoteVideoRef);
  }
}

/** Copy your current Peer ID to the clipboard */
async copyMyId() {
  if (!this.myPeerId) {
    alert('No Peer ID yet. Click "Start Video Chat" first.');
    return;
  }
  try {
    await navigator.clipboard.writeText(this.myPeerId);
    console.log('Copied ID:', this.myPeerId);
  } catch {
    alert('Copy failed — select the ID and copy manually.');
  }
}

/** Generate a fresh Peer ID (useful if the old one looks stuck) */
newPeerId() {
  // keepLocal=true → end any call but keep the camera on
  this.endCall(true);
  try { this.peer?.destroy(); } catch {}
  this.peer = undefined;
  this.myPeerId = '';
  this.ensurePeer(); // re-create and get a new ID
}


  /** ---------- Users (Super local) ---------- */
  createUser() {
    if (!this.newUsername || !this.newEmail) return;
    const user = this.authService.createUser(this.newUsername, this.newEmail, this.newRole);
    if (user) this.allUsers.push(user);
    this.newUsername = '';
    this.newEmail = '';
  }
  promoteUser(user: User, role: 'groupAdmin' | 'super') {
    this.authService.promoteUser(user.id, role);
  }
  deleteUser(user: User) {
    this.authService.deleteUser(user.id);
    this.allUsers = this.allUsers.filter(u => u.id !== user.id);
  }

  /** ---------- Groups & Channels ---------- */
  createGroup(groupName: string) {
    if (!groupName.trim()) return;
    this.groupService.createGroup(groupName.trim(), this.currentUser.id).subscribe({
      next: () => this.refreshGroups()
    });
  }

  addChannelToGroup(group: Group, channelName: string) {
    if (!channelName.trim()) return;
    if (!this.canModerate(group)) { alert('Not allowed to add channels to this group.'); return; }

    this.groupService.createChannel(group.id, channelName.trim()).subscribe({
      next: () => {
        const keepId = group.id;
        this.refreshGroups();
        setTimeout(() => {
          const g = this.groups.find(x => x.id === keepId);
          if (g) this.selectGroup(g);
        });
      }
    });
  }

  requestToJoin(group: Group) {
    this.groupService.requestToJoin(group.id, this.currentUser.id).subscribe({
      next: () => this.refreshGroups()
    });
  }
  approveJoinRequest(group: Group, userId: string) {
    this.groupService.approveJoinRequest(group.id, userId).subscribe({
      next: () => this.refreshGroups()
    });
  }
  rejectJoinRequest(group: Group, userId: string) {
    this.groupService.rejectJoinRequest(group.id, userId).subscribe({
      next: () => this.refreshGroups()
    });
  }

  leaveGroup(group: Group) {
    this.groupService.leaveGroup(group.id, this.currentUser.id).subscribe({
      next: (res) => {
        if (res?.ok) {
          if (this.selectedGroup?.id === group.id) {
            this.selectedGroup = null;
            this.selectedChannel = null;
            this.messages = [];
            this.joined = false;
          }
          this.refreshGroups();
        } else {
          alert('Unable to leave the group.');
        }
      }
    });
  }

  deleteGroup(group: Group) {
    if (!this.canModerate(group)) { alert('Not allowed to delete this group.'); return; }

    this.groupService.deleteGroup(group.id).subscribe({
      next: (res) => {
        if (res?.ok) {
          if (this.selectedGroup?.id === group.id) {
            this.selectedGroup = null;
            this.selectedChannel = null;
            this.messages = [];
            this.joined = false;
          }
          this.groups = this.groups.filter(g => g.id !== group.id);
        } else {
          alert('Unable to delete this group.');
        }
      }
    });
  }

  removeChannel(group: Group, channelId: string) {
    if (!this.canModerate(group)) { alert('Not allowed to remove channels in this group.'); return; }

    this.groupService.removeChannel(group.id, channelId).subscribe({
      next: (res) => {
        if (res?.ok) {
          const g = this.groups.find(x => x.id === group.id);
          if (g) {
            g.channels = (g.channels || []).filter(c => c.id !== channelId);
            if (this.selectedChannel?.id === channelId) {
              this.selectedChannel = null;
              this.messages = [];
              this.joined = false;
            }
            if (this.selectedGroup?.id === g.id) this.selectGroup(g);
          } else {
            this.refreshGroups();
          }
        } else {
          alert('Unable to remove channel.');
        }
      }
    });
  }

  /** Ban/unban by username */
  banUser(group: Group | null, channel: Channel | null, username: string) {
    if (!group || !channel) { alert('Pick a channel first (click a channel name), then ban.'); return; }
    if (!this.canModerate(group)) { alert('Not allowed to ban in this channel.'); return; }
    const name = (username || '').trim();
    if (!name) { alert('Enter a username'); return; }

    this.groupService
      .banUserInChannel(group.id, channel.id, undefined, name)
      .subscribe({
        next: () => {
          if (!this.isSuper && this.isGroupAdmin) {
            this.groupService.reportToSuper({
              groupId: group.id,
              channelId: channel.id,
              username: name,
              actorUserId: this.currentUserId,
              actorUsername: this.username,
              reason: 'Channel ban by username (GA)'
            }).subscribe(() => {
              if (this.isSuper) this.loadReports();
            });
          }
          this.refreshGroups();
        }
      });
  }

  unbanUser(group: Group | null, channel: Channel | null, username: string) {
    if (!group || !channel) { alert('Pick a channel first (click a channel name), then unban.'); return; }
    if (!this.canModerate(group)) { alert('Not allowed to unban in this channel.'); return; }
    const name = (username || '').trim();
    if (!name) { alert('Enter a username'); return; }
    this.groupService
      .unbanUserInChannel(group.id, channel.id, undefined, name)
      .subscribe({ next: () => this.refreshGroups() });
  }

  /** ---------- Utility ---------- */
  getUserById(id: string): User | undefined {
    return this.authService.getAllUsers().find(u => u.id === id);
  }

  public groupMemberIds(group: any): string[] {
    const users   = Array.isArray(group?.users) ? group.users : [];
    const members = Array.isArray(group?.members) ? group.members : [];
    return [...users, ...members].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
  }

  public channelMemberIds(ch: any): string[] {
    if (!ch) return [];
    const members: string[] = Array.isArray(ch?.members) ? ch.members : [];
    const bannedNames: string[] = Array.isArray((ch as any)?.bannedUsernames)
      ? (ch as any).bannedUsernames
      : [];
    return members.filter(id => {
      const uname = this.getUserById(id)?.username || '';
      return !bannedNames.includes(uname);
    });
  }
}


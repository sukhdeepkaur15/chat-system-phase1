import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import Peer, { MediaConnection } from 'peerjs';

@Component({
  selector: 'app-video-chat',
  template: `
    <div style="display:flex; gap:12px; align-items:flex-start;">
      <div>
        <h4>Me</h4>
        <video #myVideo autoplay muted playsinline style="width:280px; border-radius:8px;"></video>
      </div>
      <div>
        <h4>Remote</h4>
        <video #otherVideo autoplay playsinline style="width:280px; border-radius:8px;"></video>
      </div>
    </div>

    <div style="margin-top:12px; display:flex; gap:8px; align-items:center;">
      <input #peerIdInput placeholder="Remote peer ID" class="input-framed" />
      <button class="btn-blue" (click)="callPeer(peerIdInput.value)">Call</button>
      <span style="opacity:.8">My Peer ID: <code>{{ myPeerId || '...' }}</code></span>
    </div>
  `
})
export class VideoChatComponent implements OnInit, OnDestroy {
  @ViewChild('myVideo',   { static: true }) myVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('otherVideo',{ static: true }) otherVideoRef!: ElementRef<HTMLVideoElement>;

  private peer!: Peer;
  private localStream!: MediaStream;
  private activeCall?: MediaConnection;
  myPeerId = '';

  async ngOnInit() {
    // 1. Get local video/audio
    this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    this.myVideoRef.nativeElement.srcObject = this.localStream;

    // 2. Create peer (random ID, or userId if you want mapping)
    this.peer = new Peer({
      host: 'localhost',
      port: 4001,
      path: '/peerjs'
    });

    // 3) Show assigned ID
    this.peer.on('open', id => {
      this.myPeerId = id;
      console.log('[peer] open:', id);
    });

    // 4) Incoming calls
    this.peer.on('call', call => {
      this.activeCall?.close();
      this.activeCall = call;

      call.answer(this.localStream);
      call.on('stream', remoteStream => {
        this.otherVideoRef.nativeElement.srcObject = remoteStream;
      });
      call.on('close', () => this.otherVideoRef.nativeElement.srcObject = null);
      call.on('error', err => console.error('[peer] call error', err));
    });

    this.peer.on('error', err => console.error('[peer] error', err));
  }

  callPeer(peerId: string) {
    const id = (peerId || '').trim();
    if (!id) { alert('Enter a remote peer ID'); return; }

    this.activeCall?.close();
    const call = this.peer.call(id, this.localStream);
    this.activeCall = call;

    call.on('stream', remoteStream => {
      this.otherVideoRef.nativeElement.srcObject = remoteStream;
    });
    call.on('close', () => this.otherVideoRef.nativeElement.srcObject = null);
    call.on('error', err => console.error('[peer] call error', err));
  }

  ngOnDestroy() {
    try { this.activeCall?.close(); } catch {}
    try { this.peer?.destroy(); } catch {}
    this.otherVideoRef.nativeElement.srcObject = null;
  }
}
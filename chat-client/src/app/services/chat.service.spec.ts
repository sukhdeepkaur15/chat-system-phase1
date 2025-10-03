import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ChatService } from './chat.service';
import { ApiService } from './api.service';
import { Message } from '../models/group.model';

describe('ChatService', () => {
  let service: ChatService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', [
      'get', 'post', 'put', 'delete', 'uploadChatImage'
    ]);

    TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: ApiService, useValue: apiSpy }
      ]
    });

    service = TestBed.inject(ChatService);
  });

  it('getMessages() calls ApiService.get and returns messages', (done) => {
    const fake: Message[] = [{ username: 'u1', content: 'hi', timestamp: 1 } as Message];
    apiSpy.get.and.returnValue(of(fake));

    service.getMessages('g1', 'c1').subscribe(res => {
      expect(apiSpy.get).toHaveBeenCalledWith('/messages', { groupId: 'g1', channelId: 'c1' });
      expect(res).toEqual(fake);
      done();
    });
  });

  it('sendMessage() posts to /messages and returns { ok, message }', (done) => {
    const server = { ok: true, message: { username: 'u1', content: 'hey', timestamp: 2 } as Message };
    apiSpy.post.and.returnValue(of(server));

    service.sendMessage('g1', 'c1', 'u1', '1', 'hey').subscribe(res => {
      expect(apiSpy.post).toHaveBeenCalledWith('/messages', {
        groupId: 'g1',
        channelId: 'c1',
        username: 'u1',
        userId: '1',
        content: 'hey'
      });
      expect(res).toEqual(server);
      done();
    });
  });

  it('sendImageMessage() delegates to ApiService.uploadChatImage', (done) => {
    const file = new File(['x'], 'pic.png', { type: 'image/png' });
    apiSpy.uploadChatImage.and.returnValue(of({ ok: true, path: '/uploads/chat/pic.png' }));

    service.sendImageMessage('g1', 'c1', 'u1', '1', file).subscribe(() => {
      expect(apiSpy.uploadChatImage).toHaveBeenCalledWith('g1', 'c1', file, 'u1', '1');
      done();
    });
  });
});


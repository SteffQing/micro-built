import { EventEmitter } from 'events';
import { firstValueFrom, take, toArray } from 'rxjs';
import { NotificationStreamService } from './notification-stream.service';

// A Redis stand-in: publish() delivers to every duplicate()'d subscriber of the channel, as pub/sub does.
function fakeRedis({ publishFails = false } = {}) {
  const subscribers: EventEmitter[] = [];
  const client = {
    duplicate: () => {
      const sub = Object.assign(new EventEmitter(), {
        subscribe: jest.fn().mockResolvedValue(1),
        quit: jest.fn().mockResolvedValue('OK'),
      });
      subscribers.push(sub);
      return sub;
    },
    publish: jest.fn(async (channel: string, message: string) => {
      if (publishFails) throw new Error('connection lost');
      subscribers.forEach((sub) => sub.emit('message', channel, message));
      return subscribers.length;
    }),
  };
  return { client, redis: { getClient: () => client } };
}

async function setup(options?: { publishFails?: boolean }) {
  const { client, redis } = fakeRedis(options);
  const service = new NotificationStreamService(redis as never);
  await service.onModuleInit();
  return { client, service };
}

describe('NotificationStreamService', () => {
  it("signals only the named users' streams", async () => {
    const { service } = await setup();
    const mine = firstValueFrom(service.stream('U-1').pipe(take(1)));
    let otherFired = false;
    const other = service.stream('U-2').subscribe(() => (otherFired = true));

    await service.publish(['U-1', 'U-3']);

    await expect(mine).resolves.toEqual({ type: 'notifications', data: { changed: true } });
    expect(otherFired).toBe(false);
    other.unsubscribe();
  });

  it('publishes each user once and skips an empty list', async () => {
    const { client, service } = await setup();
    await service.publish([]);
    expect(client.publish).not.toHaveBeenCalled();

    await service.publish(['U-1', 'U-1', 'U-2']);
    expect(client.publish).toHaveBeenCalledWith('mb:notifications:changed', JSON.stringify(['U-1', 'U-2']));
  });

  it("still signals this process's streams when Redis refuses the publish", async () => {
    const { service } = await setup({ publishFails: true });
    const event = firstValueFrom(service.stream('U-1').pipe(take(1)));
    await expect(service.publish(['U-1'])).resolves.toBeUndefined();
    await expect(event).resolves.toMatchObject({ type: 'notifications' });
  });

  it("sends a support event to the named users' streams only, alongside their notifications", async () => {
    const { client, service } = await setup();
    const mine = firstValueFrom(service.stream('U-1').pipe(take(1)));
    let otherFired = false;
    const other = service.stream('U-2').subscribe(() => (otherFired = true));

    await service.publishSupport(['U-1', 'U-1', 'A-1'], { conversationId: 'c1', type: 'message', messageId: 'm1' });

    await expect(mine).resolves.toEqual({ type: 'support', data: { conversationId: 'c1', type: 'message', messageId: 'm1' } });
    expect(otherFired).toBe(false);
    expect(client.publish).toHaveBeenCalledWith(
      'mb:support:users',
      JSON.stringify({ userIds: ['U-1', 'A-1'], event: { conversationId: 'c1', type: 'message', messageId: 'm1' } }),
    );
    other.unsubscribe();
  });

  it('ignores a support message that is not an event', async () => {
    const { client, service } = await setup();
    let fired = false;
    const sub = service.stream('U-1').subscribe(() => (fired = true));
    await client.publish('mb:support:users', JSON.stringify({ userIds: ['U-1'], event: { type: 'nonsense' } }));
    await client.publish('mb:support:users', 'not json');
    expect(fired).toBe(false);
    sub.unsubscribe();
  });

  it('ends every stream on shutdown', async () => {
    const { service } = await setup();
    const events = firstValueFrom(service.stream('U-1').pipe(toArray()));
    await service.onApplicationShutdown();
    await expect(events).resolves.toEqual([]);
  });
});

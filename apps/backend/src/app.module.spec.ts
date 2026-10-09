// better-auth is ESM Jest doesn't compile: its modules are stood in for (none of them is wiring under test).
jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));
jest.mock('src/auth/auth.module', () => ({ AuthModule: class {} }));
jest.mock('src/auth/access.guard', () => ({ AccessGuard: class {} }));
jest.mock('src/auth/bullboard.middleware', () => ({ BullBoardMiddleware: class {} }));
jest.mock('src/notifications/mail.service', () => ({ MailService: class {} }));
// The PDF renderer is ESM too, reached through the customers module's documents and queue modules.
jest.mock('src/documents/render/pdf', () => ({ renderStatementPdf: jest.fn(), renderReportPdf: jest.fn() }));

import 'reflect-metadata';
// Loaded from the app's root, in the order the API boots: a cycle only bites in the order it's loaded.
import { AppModule } from 'src/app.module';

type Provider = (new (...args: never[]) => unknown) | { useClass?: new (...args: never[]) => unknown };

/** Every class a module (and what it imports) provides whose constructor names a type that's undefined at load time. */
function undefinedDependencies(root: unknown): string[] {
  const seen = new Set<unknown>();
  const bad: string[] = [];
  const visit = (mod: unknown) => {
    if (!mod || seen.has(mod)) return;
    seen.add(mod);
    for (const provider of (Reflect.getMetadata('providers', mod as object) ?? []) as Provider[]) {
      const cls = typeof provider === 'function' ? provider : provider.useClass;
      if (!cls) continue;
      const types = (Reflect.getMetadata('design:paramtypes', cls) ?? []) as unknown[];
      // Parameters injected by an explicit token (@InjectQueue, @Inject) don't need their type.
      const tokened = new Set(((Reflect.getMetadata('self:paramtypes', cls) ?? []) as { index: number }[]).map((p) => p.index));
      types.forEach((type, i) => {
        if (tokened.has(i)) return;
        // Compiled file by file (as Jest does), a type that's undefined at load time is recorded as Object; nothing
        // here injects a plain Object, so both mean the same.
        if (type === undefined || type === Object) bad.push(`${cls.name} [${i}]`);
      });
    }
    for (const imported of (Reflect.getMetadata('imports', mod as object) ?? []) as unknown[]) {
      visit(typeof imported === 'function' ? imported : (imported as { module?: unknown } | undefined)?.module);
    }
  };
  visit(root);
  return bad;
}

// A circular import once left SupportService's SupportSweepService undefined when Nest read its constructor, and
// the API didn't boot ("can't resolve dependencies of the SupportService (…, ?)"); unit specs build services by hand
// and never noticed.
describe('module wiring', () => {
  it('names a defined class for every constructor dependency', () => {
    expect(undefinedDependencies(AppModule)).toEqual([]);
  });
});

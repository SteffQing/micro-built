// better-auth is ESM Jest doesn't compile: its modules are stood in for (none of them is wiring under test).
jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));
jest.mock('src/auth/auth.module', () => ({ AuthModule: class {} }));
jest.mock('src/auth/access.guard', () => ({ AccessGuard: class {} }));
jest.mock('src/auth/bullboard.middleware', () => ({ BullBoardMiddleware: class {} }));
jest.mock('src/notifications/mail.service', () => ({ MailService: class {} }));
// The PDF renderer is ESM too, reached through the customers module's documents and queue modules.
jest.mock('src/documents/render/pdf', () => ({ renderStatementPdf: jest.fn(), renderReportPdf: jest.fn() }));

import 'reflect-metadata';
import { ModuleRef, ModulesContainer, Reflector } from '@nestjs/core';
// Loaded from the app's root, in the order the API boots: a cycle only bites in the order it's loaded.
import { AppModule } from 'src/app.module';
import { AuthAccountsService } from 'src/auth/auth-accounts.service';

// Stood in for above, so their modules export nothing here: not checked.
const STUBBED = new Set<unknown>([AuthAccountsService]);
// Nest's own core providers, in every module's scope.
const CORE = [ModuleRef, ModulesContainer, Reflector];

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

type Mod = (new (...args: never[]) => unknown) & object;
type Dynamic = { module: Mod; providers?: unknown[]; exports?: unknown[]; global?: boolean };

const moduleOf = (entry: unknown): Mod | undefined =>
  typeof entry === 'function' ? (entry as Mod) : (entry as Dynamic | undefined)?.module;
const isModule = (entry: unknown) => {
  const mod = moduleOf(entry);
  return !!mod && (typeof entry === 'object' || Reflect.getMetadataKeys(mod).some((k) => k === 'imports' || k === 'providers'));
};
const meta = (entry: unknown, key: 'providers' | 'imports' | 'exports'): unknown[] => [
  ...((Reflect.getMetadata(key, moduleOf(entry) as object) ?? []) as unknown[]),
  ...(typeof entry === 'object' && entry ? (((entry as Record<string, unknown>)[key] as unknown[]) ?? []) : []),
];
const tokenOf = (provider: unknown) =>
  typeof provider === 'function' ? provider : (provider as { provide?: unknown } | undefined)?.provide;

/**
 * Every class-typed constructor dependency that isn't in its module's scope: neither provided by the module nor
 * exported by a module it imports, nor global. Nest refuses to boot on one ("can't resolve dependencies of …").
 */
function unresolvedDependencies(root: unknown, stubbed: Set<unknown>): string[] {
  const all = new Set<unknown>();
  const collect = (entry: unknown) => {
    if (!entry || all.has(entry)) return;
    all.add(entry);
    meta(entry, 'imports').forEach(collect);
  };
  collect(root);

  const exportsOf = (entry: unknown, seen = new Set<unknown>()): unknown[] => {
    if (seen.has(entry)) return [];
    seen.add(entry);
    return meta(entry, 'exports').flatMap((e) => (isModule(e) ? exportsOf(e, seen) : [tokenOf(e)]));
  };
  const global = [...all]
    .filter((e) => (e as Dynamic).global || Reflect.getMetadata('__module:global__', moduleOf(e) as object))
    .flatMap((e) => exportsOf(e));

  const bad: string[] = [];
  for (const entry of all) {
    const scope = new Set<unknown>([
      ...meta(entry, 'providers').map(tokenOf),
      ...meta(entry, 'imports').flatMap((e) => exportsOf(e)),
      ...global,
      ...CORE,
    ]);
    for (const provider of meta(entry, 'providers') as Provider[]) {
      const cls = typeof provider === 'function' ? provider : provider.useClass;
      if (!cls) continue;
      const types = (Reflect.getMetadata('design:paramtypes', cls) ?? []) as unknown[];
      const tokened = new Set(((Reflect.getMetadata('self:paramtypes', cls) ?? []) as { index: number }[]).map((p) => p.index));
      types.forEach((type, i) => {
        if (tokened.has(i) || typeof type !== 'function' || type === Object || stubbed.has(type)) return;
        if (!scope.has(type)) bad.push(`${cls.name} [${i}] ${type.name} in ${moduleOf(entry)?.name}`);
      });
    }
  }
  return bad;
}

// A circular import once left SupportService's SupportSweepService undefined when Nest read its constructor, and
// the API didn't boot ("can't resolve dependencies of the SupportService (…, ?)"); unit specs build services by hand
// and never noticed.
describe('module wiring', () => {
  it('names a defined class for every constructor dependency', () => {
    expect(undefinedDependencies(AppModule)).toEqual([]);
  });

  // ServicesConsumer once took AuditService without its module importing AuditModule, and the API didn't boot.
  it("finds every constructor dependency in its module's scope", () => {
    expect(unresolvedDependencies(AppModule, STUBBED)).toEqual([]);
  });
});

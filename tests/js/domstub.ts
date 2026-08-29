const store = new Map<string, string>();

const localStorageStub = {
  getItem: (k: string): string | null => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string): void => { store.set(k, String(v)); },
  removeItem: (k: string): void => { store.delete(k); },
  clear: (): void => { store.clear(); },
};

const locationStub = { pathname: '/', origin: 'https://trove.saul.pw', href: 'https://trove.saul.pw/' };

const documentStub = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
};

const g = globalThis as any;
g.localStorage = localStorageStub;
g.location = locationStub;
g.document = documentStub;
g.history = { pushState: () => {} };
g.window = Object.assign(g.window || {}, { location: locationStub, addEventListener: () => {} });

export const setPath = (p: string): void => { locationStub.pathname = p; };
export const setStorage = (k: string, v: string): void => { store.set(k, v); };
export const clearStorage = (): void => { store.clear(); };

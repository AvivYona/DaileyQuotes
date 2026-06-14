export const tokenSuffix = (token: string): string =>
  token ? `…${token.slice(-8)}` : '∅';

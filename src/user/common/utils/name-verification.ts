function normalizeName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

function nameMatches(accountName: string, identityName: string): boolean {
  const accountTokens = normalizeName(accountName);
  const identityTokens = normalizeName(identityName);

  const matchCount = identityTokens.filter((token) =>
    accountTokens.includes(token),
  ).length;

  return matchCount >= 2;
}

export default nameMatches;

export function parseLodestoneCharacterId(input: string): number | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname.endsWith('finalfantasyxiv.com')) {
      return null;
    }

    const match = url.pathname.match(/^\/lodestone\/character\/(\d+)\/?$/i);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

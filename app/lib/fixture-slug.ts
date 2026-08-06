export function makeFixtureSlug(opponent: string, kickoff: Date): string {
  const name = opponent
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const day = kickoff.getUTCDate();
  const month = months[kickoff.getUTCMonth()];
  const year = kickoff.getUTCFullYear();
  return `${name}-${day}-${month}-${year}`;
}

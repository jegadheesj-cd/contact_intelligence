/**
 * Calculates Levenshtein distance based string similarity (0.0 to 1.0)
 */
export function stringSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.8; // High score for substring match

  const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j] + 1, // deletion
        matrix[i - 1][j - 1] + indicator // substitution
      );
    }
  }

  const distance = matrix[a.length][b.length];
  const maxLen = Math.max(a.length, b.length);
  
  if (maxLen === 0) return 1.0;
  return (maxLen - distance) / maxLen;
}

export function findLevelById(
  levels: any[],
  id: any
): any | null {
  const targetId = id.toString();

  for (const level of levels) {
    if (level._id?.toString() === targetId) {
      return level;
    }

    if (level.children?.length) {
      const found = findLevelById(level.children, targetId);
      if (found) return found;
    }
  }

  return null;
}
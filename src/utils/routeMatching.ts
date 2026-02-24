export const isRouteActive = (currentPathname: string, targetPath: string): boolean => {
  const currentPath = currentPathname.replace(/\/+$/, '') || '/';
  const normalizedTargetPath = targetPath.replace(/\/+$/, '') || '/';

  if (normalizedTargetPath === '/') {
    return currentPath === '/';
  }

  return currentPath === normalizedTargetPath || currentPath.startsWith(`${normalizedTargetPath}/`);
};

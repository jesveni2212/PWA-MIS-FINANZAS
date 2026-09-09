function normalizePath(path: string): string {
  const withoutTrailingSlash = path.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}

export function isNavigationItemActive(pathname: string, href: string): boolean {
  const currentPath = normalizePath(pathname || "/");
  const itemPath = normalizePath(href || "/");

  if (itemPath === "/") return currentPath === "/";
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

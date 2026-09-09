export function getGreetingLabel(displayName: string | null | undefined): string {
  const normalizedName = displayName?.trim();
  return normalizedName ? `Hola, ${normalizedName}` : "Bienvenido/a";
}

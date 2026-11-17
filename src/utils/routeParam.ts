/** Normalizes Express route params across Express type versions. */
export const routeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? '' : value ?? '';

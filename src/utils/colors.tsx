export const routeColors: Record<number, string> = {
  1: '#1abc9c', 
  2: '#e67e22', 
  3: '#3498db', 
};

export function getRouteColor(id: number): string {
  return routeColors[id] ?? '#ffb400'; 
}
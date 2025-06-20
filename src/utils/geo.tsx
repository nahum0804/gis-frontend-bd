import { point, lineString, nearestPointOnLine, distance } from '@turf/turf';

export function isNearby(coords: [number, number][], userPos: [number, number], maxKm = 1): boolean {
  const userPt = point([userPos[1], userPos[0]]);
  const line = lineString(coords.map(c => [c[0], c[1]]));
  const snapped = nearestPointOnLine(line, userPt);
  return distance(userPt, snapped, { units: 'kilometers' }) <= maxKm;
}
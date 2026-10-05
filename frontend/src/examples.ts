import type { Location } from './types';

export const examples: {
  name: string;
  description: string;
  cycle: number;
  locations: Location[];
}[] = [
  {
    name: 'Regional run',
    description: 'Richmond → Baltimore → Newark',
    cycle: 12,
    locations: [
      { label: 'Richmond, Virginia', coordinates: [-77.436, 37.5407] },
      { label: 'Baltimore, Maryland', coordinates: [-76.6122, 39.2904] },
      { label: 'Newark, New Jersey', coordinates: [-74.1724, 40.7357] },
    ],
  },
  {
    name: 'Across state lines',
    description: 'Los Angeles → Phoenix → Dallas',
    cycle: 20,
    locations: [
      { label: 'Los Angeles, California', coordinates: [-118.2437, 34.0522] },
      { label: 'Phoenix, Arizona', coordinates: [-112.074, 33.4484] },
      { label: 'Dallas, Texas', coordinates: [-96.797, 32.7767] },
    ],
  },
  {
    name: 'Near cycle limit',
    description: 'Chicago → Indianapolis → Atlanta',
    cycle: 68,
    locations: [
      { label: 'Chicago, Illinois', coordinates: [-87.6298, 41.8781] },
      { label: 'Indianapolis, Indiana', coordinates: [-86.1581, 39.7684] },
      { label: 'Atlanta, Georgia', coordinates: [-84.388, 33.749] },
    ],
  },
];

import { ServiceProvider } from '@subscription-tracker/types';

export const STREAMING_SERVICES: ServiceProvider[] = [
  {
    id: 'svc_spotify',
    name: 'Spotify',
    category: 'music',
    supportsOAuth: true,
    description: 'Premium music streaming',
  },
  {
    id: 'svc_youtube_premium',
    name: 'YouTube Premium',
    category: 'streaming',
    supportsOAuth: true,
    description: 'Ad-free YouTube + Music',
  },
  {
    id: 'svc_netflix',
    name: 'Netflix',
    category: 'streaming',
    supportsOAuth: false,
    description: 'On-demand series and films',
  },
  {
    id: 'svc_disney_plus',
    name: 'Disney+',
    category: 'streaming',
    supportsOAuth: false,
    description: 'Disney, Marvel, Star Wars catalog',
  },
  {
    id: 'svc_hulu',
    name: 'Hulu',
    category: 'streaming',
    supportsOAuth: false,
    description: 'TV + originals',
  },
];

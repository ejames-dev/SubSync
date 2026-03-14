import { ServiceProvider } from '@subscription-tracker/types';

export const STREAMING_SERVICES: ServiceProvider[] = [
  {
    id: 'svc_spotify',
    name: 'Spotify',
    category: 'music',
    supportsOAuth: true,
    description: 'Premium music streaming',
    logoUrl: 'https://logo.clearbit.com/spotify.com',
  },
  {
    id: 'svc_youtube_premium',
    name: 'YouTube Premium',
    category: 'streaming',
    supportsOAuth: true,
    description: 'Ad-free YouTube + Music',
    logoUrl: 'https://logo.clearbit.com/youtube.com',
  },
  {
    id: 'svc_netflix',
    name: 'Netflix',
    category: 'streaming',
    supportsOAuth: false,
    description: 'On-demand series and films',
    logoUrl: 'https://logo.clearbit.com/netflix.com',
  },
  {
    id: 'svc_disney_plus',
    name: 'Disney+',
    category: 'streaming',
    supportsOAuth: false,
    description: 'Disney, Marvel, Star Wars catalog',
    logoUrl: 'https://logo.clearbit.com/disneyplus.com',
  },
  {
    id: 'svc_hulu',
    name: 'Hulu',
    category: 'streaming',
    supportsOAuth: false,
    description: 'TV + originals',
    logoUrl: 'https://logo.clearbit.com/hulu.com',
  },
];

export type UserProfile = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  followers: number;
  following: number;
  tags: string[];
  socials?: { twitter?: string; youtube?: string; tiktok?: string };
};

export type Stream = {
  id: string;
  title: string;
  category: string;
  live: boolean;
  viewers: number;
  username: string; // handle without @
  userId: string;
  thumbnail?: string; // placeholder, not used
  startedAt?: string;
  duration?: string; // for replays
};

export const users: Record<string, UserProfile> = {
  u1: {
    id: 'u1', handle: 'kasperghost', displayName: 'Kasper Ghost',
    bio: 'Streaming crypto chats, IRL coffee walks, and Kaspa dev talk.',
    followers: 12400, following: 210, tags: ['Crypto', 'IRL', 'Tech'],
    socials: { twitter: 'kasperghost' }
  },
  u2: {
    id: 'u2', handle: 'vivoor_irl', displayName: 'Vivoor IRL',
    bio: 'City explorations and street interviews. Be kind, be curious.',
    followers: 8800, following: 120, tags: ['IRL', 'Talk'],
  },
  u3: {
    id: 'u3', handle: 'beatsbyrei', displayName: 'Beats by Rei',
    bio: 'Live beatmaking and looping sessions. Requests welcome!',
    followers: 15230, following: 98, tags: ['Music', 'Live Loops'],
    socials: { youtube: 'beatsbyrei' }
  },
};

export const streams: Stream[] = [
  { id: 's1', title: 'Kaspa Dev AMA', category: 'Crypto', live: true, viewers: 980, username: 'kasperghost', userId: 'u1', startedAt: 'now' },
  { id: 's2', title: 'Lo-fi beats + chat', category: 'Music', live: true, viewers: 312, username: 'beatsbyrei', userId: 'u3', startedAt: 'now' },
  { id: 's3', title: 'Night city walk', category: 'IRL', live: false, viewers: 0, username: 'vivoor_irl', userId: 'u2', duration: '1:12:43' },
  { id: 's4', title: 'Speedrunning classics', category: 'Gaming', live: true, viewers: 1200, username: 'speedy', userId: 'u4' },
  { id: 's5', title: 'Open talk: crypto safety', category: 'Talk', live: false, viewers: 0, username: 'kasperghost', userId: 'u1', duration: '58:02' },
  { id: 's6', title: 'Street portraits', category: 'IRL', live: true, viewers: 205, username: 'vivoor_irl', userId: 'u2' },
  { id: 's7', title: 'Drum & bass live build', category: 'Music', live: false, viewers: 0, username: 'beatsbyrei', userId: 'u3', duration: '44:12' },
  { id: 's8', title: 'Crypto news recap', category: 'Crypto', live: false, viewers: 0, username: 'blockbytes', userId: 'u5', duration: '32:20' },
  { id: 's9', title: 'Casual chat + Q&A', category: 'Talk', live: true, viewers: 67, username: 'sarah', userId: 'u6' },
  { id: 's10', title: 'Indie games spotlight', category: 'Gaming', live: false, viewers: 0, username: 'indiehunt', userId: 'u7', duration: '1:54:05' },
  { id: 's11', title: 'Parkour training', category: 'Sports', live: true, viewers: 402, username: 'flip', userId: 'u8' },
  { id: 's12', title: 'Kaspa wallets 101', category: 'Crypto', live: false, viewers: 0, username: 'kasperghost', userId: 'u1', duration: '26:31' },
  { id: 's13', title: 'Morning chill set', category: 'Music', live: true, viewers: 188, username: 'beatsbyrei', userId: 'u3' },
  { id: 's14', title: 'IRL bike ride', category: 'IRL', live: false, viewers: 0, username: 'vivoor_irl', userId: 'u2', duration: '47:09' },
  { id: 's15', title: 'Crypto dev stream', category: 'Crypto', live: true, viewers: 520, username: 'devdude', userId: 'u9' },
  { id: 's16', title: 'Late night coding', category: 'Tech', live: false, viewers: 0, username: 'devdude', userId: 'u9', duration: '2:03:34' },
];

export const allCategories = ['IRL', 'Music', 'Gaming', 'Talk', 'Sports', 'Crypto', 'Tech'];

export function getStreamById(id: string) {
  return streams.find((s) => s.id === id);
}
export function getUserByHandle(handle: string) {
  const entry = Object.values(users).find((u) => u.handle === handle);
  return entry;
}

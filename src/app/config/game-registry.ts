export type GameId = 'generic' | 'wormskull';

export interface GameProfile {
  id: GameId;
  label: string;
}

export const GAMES: GameProfile[] = [
  { id: 'generic', label: 'RPG Maker MV (Generic)' },
  { id: 'wormskull', label: 'Wormskull' }
];

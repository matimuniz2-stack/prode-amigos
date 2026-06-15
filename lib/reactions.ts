/* Emojis permitidos para reaccionar a los picks de los demás (chicana sana).
   Tiene que coincidir con el CHECK de la migración 20260615230000_pick_reactions.sql */
export const REACTION_EMOJIS = ["🔥", "🤡", "😂", "💩", "🐐", "🎯"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function isReactionEmoji(v: string): v is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(v);
}

export interface ReactionCount {
  emoji: string;
  count: number;
  /** Si el usuario actual ya reaccionó con este emoji. */
  mine: boolean;
}

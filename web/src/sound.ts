import type { Theme } from "./types";
let lastPlayed = 0;
const players = new Map<string, HTMLAudioElement>();
export function playSound(
  kind: "open" | "hold" | "success" | "error",
  theme: Theme,
) {
  if (!theme.sound || theme.soundVolume <= 0 || Date.now() - lastPlayed < 120)
    return;
  lastPlayed = Date.now();
  let player = players.get(kind);
  if (!player) {
    player = new Audio(`./sounds/${kind}.wav`);
    players.set(kind, player);
  }
  player.volume = theme.soundVolume;
  player.currentTime = 0;
  void player.play().catch(() => undefined);
}

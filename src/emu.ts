import type { ConsoleCode, Game } from "./types";

export const EMU: Record<ConsoleCode, { name: string; url: string; label: string }> = {
  SNES: { name: "Snes9x", url: "https://www.snes9x.com/", label: "Super Nintendo (SNES)" },
  MD: { name: "BlastEm", url: "https://www.retrodev.com/blastem/", label: "Mega Drive / Genesis" },
  N64: { name: "Project64", url: "https://www.pj64-emu.com/", label: "Nintendo 64" },
  PS1: { name: "DuckStation", url: "https://www.duckstation.org/", label: "PlayStation" },
  GBA: { name: "mGBA", url: "https://mgba.io/", label: "Game Boy Advance" },
  GBC: { name: "mGBA", url: "https://mgba.io/", label: "Game Boy Color" },
};

/** Rótulo curto do console (sem parênteses) para listas. */
export const consoleShort = (c: ConsoleCode) => EMU[c].label.replace(/ \(.*\)/, "");

export const romSearchUrl = (g: Pick<Game, "title" | "console">) =>
  "https://www.google.com/search?hl=pt-BR&lr=lang_pt&q=" +
  encodeURIComponent(`${g.title} ${EMU[g.console].label} rom português download`);

// hqdefault existe pra todo vídeo; as barras 4:3 são cortadas por background-size:cover no .play-poster
export const ytPoster = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const ytWatch = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const ytEmbed = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

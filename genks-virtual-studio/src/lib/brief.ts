/**
 * "Your beat in one sentence" (custom beat): reads genre, BPM and mood from a free sentence,
 * the way a producer would, so the brief can be filled in for the client. Pure, unit-tested.
 */
const GENRE_WORDS: [string, RegExp][] = [
  ["Trap", /trap/i], ["Drill", /drill/i], ["R&B", /r\s*&\s*b|rnb|soul/i], ["Boom bap", /boom\s*bap|old\s*school/i],
  ["Afro", /afro|amapiano/i], ["Lo-fi", /lo-?\s*fi|chill\s*hop/i], ["Pop", /\bpop\b/i],
];
const MOOD_WORDS: [string, RegExp][] = [
  ["Notturno", /nott|night|sera/i], ["Energico", /energ|caric|hype|spinta/i], ["Malinconico", /malincon|trist|sad/i],
  ["Solare", /solar|estiv|summer|allegr|happy/i], ["Cupo", /\bcup|dark|scur|oscur/i], ["Morbido", /morbid|soft|dolc|chill/i],
];

export function parseBrief(text: string, moods: readonly string[]) {
  const genre = GENRE_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
  // "140 bpm" wins; otherwise the first number that can be a tempo (so "808" is not read as BPM)
  const tagged = text.match(/(\d{2,3})\s*bpm/i);
  const nums = [...text.matchAll(/\b(\d{2,3})\b/g)].map(m => Number(m[1])).filter(n => n >= 60 && n <= 180);
  const bpm = tagged && Number(tagged[1]) >= 60 && Number(tagged[1]) <= 180 ? Number(tagged[1]) : nums[0] ?? null;
  const found = MOOD_WORDS.filter(([, re]) => re.test(text)).map(([w]) => w).filter(w => moods.includes(w));
  return { genre, bpm, moods: found };
}

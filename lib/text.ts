// Length-preserving diacritic fold: a precomposed accented char decomposes
// (NFD) to base + combining mark, we drop the mark, leaving one char per source
// char. So a match offset in the folded string lines up with the original —
// which lets us highlight the matched slice of the real name.
export const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export const matchIndex = (text: string, query: string) => {
  const q = fold(query.trim());
  return q ? fold(text).indexOf(q) : -1;
};

if (import.meta.main) {
  const a = "La Défense";
  console.assert(fold(a).length === a.length, "fold must preserve length");
  console.assert(matchIndex(a, "defense") === 3, "accent-insensitive match");
  console.assert(a.slice(3, 3 + "defense".length) === "Défense", "slice aligns to original");
  console.log("text.ts ok");
}

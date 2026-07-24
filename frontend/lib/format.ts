/** XOF (unités) → « N M FCFA » (millions, format fr). */
export function fmtM(xof: number): string {
  return `${Math.round(xof / 1_000_000).toLocaleString("fr-FR")} M FCFA`;
}

/** Entier au format fr (séparateur de milliers). */
export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("fr-FR");
}

/** Pourcentage au format fr avec 1 décimale : 34.18 → « 34,2 % ». */
export function fmtPct(n: number): string {
  return `${n.toFixed(1).replace(".", ",")} %`;
}

/** Taille de fichier lisible : 1536 → « 1,5 Ko ». */
export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ["Ko", "Mo", "Go"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1).replace(".", ",")} ${units[i]}`;
}

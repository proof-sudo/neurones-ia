import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonome : .next/standalone embarque server.js + le sous-ensemble
  // de node_modules réellement tracé, pour une image Docker minimale servie
  // par `node server.js` (cf. frontend/Dockerfile) au lieu de `next start`.
  output: "standalone",

  // Badge dev Next (rond noir) déplacé : en bas à gauche il recouvrait le
  // bouton Déconnexion de la sidebar ; en bas à droite il gênerait le FAB Sales IA.
  devIndicators: {
    position: "top-right",
  },
};

export default nextConfig;

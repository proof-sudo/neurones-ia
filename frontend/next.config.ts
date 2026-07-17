import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Badge dev Next (rond noir) déplacé : en bas à gauche il recouvrait le
  // bouton Déconnexion de la sidebar ; en bas à droite il gênerait le FAB Sales IA.
  devIndicators: {
    position: "top-right",
  },
};

export default nextConfig;

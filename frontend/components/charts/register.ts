// Enregistrement centralisé des modules Chart.js (importé par tous les
// composants de graphes). Les modules ES étant des singletons, l'appel
// register() ne s'exécute qu'une fois quel que soit le nombre d'imports.
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
);

ChartJS.defaults.color = "#6B6D75";
ChartJS.defaults.font.family = "'IBM Plex Mono', monospace";
ChartJS.defaults.font.size = 10.5;

export const CHART_GRID = "#DEDED7";

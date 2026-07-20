import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Fusion de classes Tailwind (port du helper shadcn du projet source). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Prode de los Pibes",
    short_name: "Prode Pibes",
    description: "Predicciones, cargadas y gloria eterna. Mundial 2026.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B3D2E",
    theme_color: "#0B3D2E",
    lang: "es-AR",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "StudyStation — AI study companion",
    short_name: "StudyStation",
    description:
      "Capture lectures, create detailed notes, revise with AI and plan your studies.",
    start_url: "/app?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#fbfaff",
    theme_color: "#7259e8",
    orientation: "any",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Record a lecture",
        short_name: "Record",
        description: "Start capturing a lecture",
        url: "/app?action=record",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Open study planner",
        short_name: "Planner",
        url: "/app?view=planner",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}

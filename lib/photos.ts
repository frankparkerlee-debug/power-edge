// Job photos for the homepage gallery — the #1 trust lift for a contractor.
// Drop image files in /public/photos and list them here. While this array is
// empty, the gallery section is hidden entirely (no empty placeholder shows).
export type Photo = { src: string; alt: string; caption?: string };

export const photos: Photo[] = [
  // Example once you add files to /public/photos:
  // { src: "/photos/roof-plano.jpg", alt: "New asphalt roof in Plano, TX", caption: "Full re-roof · Plano" },
  // { src: "/photos/panel-dallas.jpg", alt: "200A panel upgrade in Dallas", caption: "200A service upgrade · Dallas" },
];

/** Mascot mark as a data URI, for generated images (OG image, Apple icon). */
const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<path d="M32 11c14 0 22 11 23 24 1 13-6 20-23 20S8 48 9 35c1-13 9-24 23-24Z" fill="#3d9bff" stroke="#13357a" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M32 11c-1.4-3.6 0-6.8 3.6-6.8 3 0 4.2 3.4 1.6 4.5" fill="none" stroke="#13357a" stroke-width="3.5" stroke-linecap="round"/>
<ellipse cx="21" cy="23" rx="6" ry="3.3" transform="rotate(-38 21 23)" fill="#fff" opacity=".85"/>
<ellipse cx="25.5" cy="35" rx="2.8" ry="3.6" fill="#13357a"/>
<ellipse cx="38.5" cy="35" rx="2.8" ry="3.6" fill="#13357a"/>
<path d="M28.5 41.5c2 2.2 5 2.2 7 0" fill="none" stroke="#13357a" stroke-width="2.6" stroke-linecap="round"/>
<ellipse cx="19" cy="41" rx="3.2" ry="1.9" fill="#ff8fb8" opacity=".8"/>
<ellipse cx="45" cy="41" rx="3.2" ry="1.9" fill="#ff8fb8" opacity=".8"/>
</svg>`;

export const mascotMarkDataUri = `data:image/svg+xml;base64,${Buffer.from(markSvg).toString("base64")}`;

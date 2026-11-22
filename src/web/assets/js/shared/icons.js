const svgIcon = (path) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

export const icons = {
  folder: svgIcon('<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.19a1.5 1.5 0 0 1 1.06.44L11 6.7a1.5 1.5 0 0 0 1.06.44H19.5A1.5 1.5 0 0 1 21 8.64V17.5A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/>'),
  image: svgIcon('<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 3.5 3.5L16 12l4.5 5"/>'),
  audio: svgIcon('<circle cx="7" cy="17" r="2.4"/><circle cx="17" cy="15" r="2.4"/><path d="M9.4 17V6.5L19.4 4v10.5"/>'),
  video: svgIcon('<rect x="3" y="5.5" width="13" height="13" rx="1.5"/><path d="m16 10 5-2.7v9.4l-5-2.7"/>'),
  document: svgIcon('<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4.5"/><path d="M9.5 12.5h5M9.5 15.5h5"/>'),
  archive: svgIcon('<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M12 4v16M9.5 8h5M9.5 12h5M9.5 16h5"/>'),
  more: svgIcon('<circle cx="12" cy="5.2" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="18.8" r="1.3" fill="currentColor" stroke="none"/>'),
  back: svgIcon('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  close: svgIcon('<path d="m6 6 12 12M18 6 6 18"/>'),
  play: svgIcon('<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>'),
  pause: svgIcon('<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>'),
  volume: svgIcon('<path d="M4 10v4h3l4.5 3.5v-11L7 10z" fill="currentColor" stroke="none"/><path d="M15 9a4.2 4.2 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
  volumeMuted: svgIcon('<path d="M4 10v4h3l4.5 3.5v-11L7 10z" fill="currentColor" stroke="none"/><path d="m16 10 4 4m0-4-4 4"/>'),
  fullscreen: svgIcon('<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>'),
  exitFullscreen: svgIcon('<path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4M20 9h-3.5A1.5 1.5 0 0 1 15 7.5V4M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20"/>'),
  download: svgIcon('<path d="M12 4v10.5m0 0 4-4m-4 4-4-4M5 19.5h14"/>'),
  speed: svgIcon('<circle cx="12" cy="13" r="8"/><path d="m12 13 3.5-4.5"/>'),
  pip: svgIcon('<rect x="3" y="5" width="18" height="14" rx="1.5"/><rect x="12.5" y="11.5" width="5" height="4" rx="0.5" fill="currentColor" stroke="none"/>'),
};

export function fileIcon(item) {
  if (item.is_folder) return icons.folder;
  const extension = item.name.split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension)) return icons.image;
  if (["mp3", "wav", "ogg", "m4a"].includes(extension)) return icons.audio;
  if (["mp4", "webm", "mov"].includes(extension)) return icons.video;
  if (["txt", "md", "py", "js", "html", "css", "json", "csv"].includes(extension)) return icons.document;
  return icons.archive;
}

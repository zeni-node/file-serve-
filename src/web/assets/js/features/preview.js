import { requestText } from "../api/client.js";
import { API_ROUTES, withQuery } from "../api/routes.js";
import { icons } from "../shared/icons.js";

const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2];

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function setupVideoPreview(content, streamUrl, { getPreviewItem, downloadFile, onMessage }) {
  const wrapper = document.createElement("div");
  wrapper.className = "player";
  const video = document.createElement("video");
  video.preload = "metadata";
  video.playsInline = true;
  video.src = streamUrl;

  const controls = document.createElement("div");
  controls.className = "player-controls";

  const progress = document.createElement("input");
  progress.type = "range";
  progress.className = "player-progress";
  progress.min = "0";
  progress.max = "1000";
  progress.value = "0";
  progress.step = "1";

  const buttons = document.createElement("div");
  buttons.className = "player-buttons";

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.className = "player-button";
  playButton.setAttribute("aria-label", "Reproduzir");
  playButton.innerHTML = icons.play;

  const timeLabel = document.createElement("span");
  timeLabel.className = "player-time";
  timeLabel.textContent = "0:00 / --:--";

  const volumeControl = document.createElement("div");
  volumeControl.className = "player-volume-control";

  const volumeButton = document.createElement("button");
  volumeButton.type = "button";
  volumeButton.className = "player-button";
  volumeButton.setAttribute("aria-label", "Silenciar");
  volumeButton.innerHTML = icons.volume;

  const volumeSlider = document.createElement("input");
  volumeSlider.type = "range";
  volumeSlider.className = "player-volume";
  volumeSlider.min = "0";
  volumeSlider.max = "1";
  volumeSlider.step = "0.05";
  volumeSlider.value = "1";
  volumeSlider.setAttribute("aria-label", "Volume");
  volumeControl.append(volumeButton, volumeSlider);

  const moreButton = document.createElement("button");
  moreButton.type = "button";
  moreButton.className = "player-button";
  moreButton.setAttribute("aria-label", "Mais opções");
  moreButton.innerHTML = icons.more;

  const fullscreenButton = document.createElement("button");
  fullscreenButton.type = "button";
  fullscreenButton.className = "player-button";
  fullscreenButton.setAttribute("aria-label", "Tela cheia");
  fullscreenButton.innerHTML = icons.fullscreen;

  const endActions = document.createElement("div");
  endActions.className = "player-end-actions";
  endActions.append(fullscreenButton, moreButton);
  buttons.append(playButton, volumeControl, timeLabel, endActions);
  controls.append(progress, buttons);

  const overlay = document.createElement("div");
  overlay.className = "player-overlay";
  overlay.hidden = true;

  const speedPanel = document.createElement("div");
  speedPanel.className = "player-speed";
  speedPanel.hidden = true;
  for (const rate of PLAYBACK_RATES) {
    const rateButton = document.createElement("button");
    rateButton.type = "button";
    rateButton.textContent = `${rate}x`;
    rateButton.className = rate === 1 ? "selected" : "";
    rateButton.addEventListener("click", () => {
      video.playbackRate = rate;
      speedPanel.querySelectorAll("button").forEach((element) => {
        element.classList.toggle("selected", element === rateButton);
      });
      speedPanel.hidden = true;
    });
    speedPanel.append(rateButton);
  }

  wrapper.append(video, controls, overlay, speedPanel);
  content.append(wrapper);

  let controlsTimer;
  const showControls = () => {
    wrapper.classList.remove("controls-hidden");
    clearTimeout(controlsTimer);
    if (!video.paused) {
      controlsTimer = setTimeout(() => wrapper.classList.add("controls-hidden"), 2500);
    }
  };
  const setPlaying = (isPlaying) => {
    playButton.innerHTML = isPlaying ? icons.pause : icons.play;
    showControls();
  };
  video.addEventListener("play", () => setPlaying(true));
  video.addEventListener("pause", () => {
    clearTimeout(controlsTimer);
    setPlaying(false);
  });
  video.addEventListener("ended", () => {
    clearTimeout(controlsTimer);
    wrapper.classList.remove("controls-hidden");
  });
  playButton.addEventListener("click", () => {
    const playback = video.paused ? video.play() : Promise.resolve(video.pause());
    playback?.catch((error) => onMessage(`Não foi possível reproduzir o vídeo: ${error.message}`, true));
  });
  wrapper.addEventListener("mousemove", showControls);
  wrapper.addEventListener("touchstart", showControls, { passive: true });
  wrapper.addEventListener("focusin", showControls);

  video.addEventListener("loadedmetadata", () => {
    timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  });
  video.addEventListener("timeupdate", () => {
    if (!video.duration) return;
    progress.value = String(Math.round(video.currentTime / video.duration * 1000));
    timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  });
  progress.addEventListener("input", () => {
    if (video.duration) {
      video.currentTime = Number(progress.value) / 1000 * video.duration;
    }
  });
  const updateVolumeIcon = () => {
    const isMuted = video.muted || video.volume === 0;
    volumeButton.innerHTML = isMuted ? icons.volumeMuted : icons.volume;
    volumeButton.setAttribute("aria-label", isMuted ? "Ativar som" : "Silenciar");
  };
  volumeButton.addEventListener("click", () => {
    video.muted = !video.muted;
    updateVolumeIcon();
    showControls();
  });
  volumeSlider.addEventListener("input", () => {
    video.volume = Number(volumeSlider.value);
    video.muted = video.volume === 0;
    updateVolumeIcon();
    showControls();
  });

  fullscreenButton.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (wrapper.requestFullscreen) {
        await wrapper.requestFullscreen();
      }
    } catch (error) {
      onMessage(`Não foi possível alterar a tela cheia: ${error.message}`, true);
    }
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreenButton.innerHTML = document.fullscreenElement ? icons.exitFullscreen : icons.fullscreen;
  });

  moreButton.addEventListener("click", (event) => {
    event.stopPropagation();
    showControls();
    overlay.hidden = !overlay.hidden;
    speedPanel.hidden = true;
  });
  const overlayActions = [
    { label: "Baixar", icon: icons.download, action: () => {
      const item = getPreviewItem();
      if (item) downloadFile(item);
    } },
    { label: "Velocidade", icon: icons.speed, action: () => {
      overlay.hidden = true;
      speedPanel.hidden = !speedPanel.hidden;
    } },
    { label: "Picture-in-picture", icon: icons.pip, action: async () => {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await video.requestPictureInPicture();
        }
      } catch (error) {
        onMessage(`Não foi possível ativar Picture-in-picture: ${error.message}`, true);
      }
    } },
  ];
  for (const { label, icon, action } of overlayActions) {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `${icon}<span>${label}</span>`;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      action();
      overlay.hidden = true;
    });
    overlay.append(button);
  }
  document.addEventListener("click", () => {
    overlay.hidden = true;
    speedPanel.hidden = true;
  });
  overlay.addEventListener("click", (event) => event.stopPropagation());
  speedPanel.addEventListener("click", (event) => event.stopPropagation());
}

export function createPreviewController({ downloadFile, onUnauthorized, onMessage }) {
  let previewItem = null;
  const dialog = document.querySelector("#preview");
  const content = document.querySelector("#preview-content");
  const downloadButton = document.querySelector("#download-preview");

  async function previewFile(item) {
    previewItem = { ...item, deleted: false };
    downloadButton.disabled = false;
    document.querySelector("#preview-title").textContent = item.name;
    content.replaceChildren();
    dialog.showModal();

    const extension = item.name.split(".").pop().toLowerCase();
    const streamUrl = withQuery(API_ROUTES.files.stream, { path: item.path });
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension)) {
      const image = document.createElement("img");
      image.src = streamUrl;
      content.append(image);
    } else if (["mp3", "wav", "ogg", "m4a"].includes(extension)) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "metadata";
      audio.src = streamUrl;
      content.append(audio);
    } else if (["mp4", "m4v", "webm", "mov", "avi", "mkv", "wmv", "mpeg", "mpg", "flv"].includes(extension)) {
      setupVideoPreview(content, streamUrl, {
        getPreviewItem: () => previewItem,
        downloadFile,
        onMessage,
      });
    } else if (["txt", "md", "py", "js", "html", "css", "json", "csv"].includes(extension)) {
      try {
        const text = document.createElement("pre");
        text.textContent = await requestText(streamUrl);
        content.append(text);
      } catch (error) {
        if (error.status === 401) {
          dialog.close();
          onUnauthorized();
          return;
        }
        content.textContent = "Não foi possível abrir a prévia.";
      }
    } else {
      content.textContent = "Prévia não disponível para este tipo de arquivo. Use Baixar para salvá-lo.";
    }
  }

  function checkPreviewStillExists(items) {
    if (!dialog.open || !previewItem || previewItem.deleted) return;
    const stillExists = items.some((item) => item.path === previewItem.path);
    if (stillExists) return;
    previewItem.deleted = true;
    content.replaceChildren();
    const message = document.createElement("p");
    message.textContent = "Este arquivo foi apagado no servidor.";
    content.append(message);
    downloadButton.disabled = true;
  }

  downloadButton.addEventListener("click", () => {
    if (previewItem) downloadFile(previewItem);
  });
  document.querySelector("#close-preview").innerHTML = icons.close;
  document.querySelector("#close-preview").addEventListener("click", () => dialog.close());

  return { previewFile, checkPreviewStillExists };
}

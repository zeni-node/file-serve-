import { ApiError } from "../api/client.js";
import { API_ROUTES, withQuery } from "../api/routes.js";
import { formatSize } from "../shared/format.js";

function updateTransfer(name, loaded, total, started) {
  const seconds = Math.max((performance.now() - started) / 1000, 0.01);
  const rate = loaded / seconds / (1024 * 1024);
  const remaining = total ? Math.max((total - loaded) / (rate * 1024 * 1024), 0) : 0;
  document.querySelector("#transfer").hidden = false;
  document.querySelector("#transfer-name").textContent = name;
  document.querySelector("#transfer-progress").value = total ? loaded / total * 100 : 0;
  document.querySelector("#transfer-details").textContent = `${formatSize(loaded)} de ${formatSize(total)} | ${rate.toFixed(2)} MB/s | cerca de ${Math.ceil(remaining)} s`;
}

export function createTransferController({
  getCurrentPath,
  loadFiles,
  onUnauthorized,
  onMessage,
}) {
  function uploadFile(file, path) {
    return new Promise((resolve, reject) => {
      const started = performance.now();
      const request = new XMLHttpRequest();
      const data = new FormData();
      data.append("file", file);
      request.open("POST", withQuery(API_ROUTES.files.upload, { path }));
      request.upload.addEventListener("progress", (event) => {
        updateTransfer(file.name, event.loaded, event.total, started);
      });
      request.addEventListener("load", () => {
        if (request.status === 401) {
          onUnauthorized();
          reject(new ApiError("Sua sessão expirou. Entre novamente.", 401));
          return;
        }
        if (request.status < 300) {
          resolve();
          return;
        }

        let message = "Não foi possível enviar o arquivo.";
        try {
          message = JSON.parse(request.responseText).error || message;
        } catch (error) {
          if (!(error instanceof SyntaxError)) {
            reject(error);
            return;
          }
        }
        reject(new ApiError(message, request.status));
      });
      request.addEventListener("error", () => {
        reject(new Error("Conexão interrompida durante o envio."));
      });
      request.send(data);
    });
  }

  async function uploadFiles(files, path = getCurrentPath()) {
    try {
      for (const file of files) {
        await uploadFile(file, path);
      }
      onMessage(path === getCurrentPath()
        ? "Envio concluído."
        : "Envio concluído para a pasta selecionada.");
      if (path === getCurrentPath()) {
        await loadFiles();
      }
    } catch (error) {
      if (error.status !== 401) {
        onMessage(error.message, true);
      }
    } finally {
      document.querySelector("#transfer").hidden = true;
    }
  }

  function downloadFile(item) {
    const link = document.createElement("a");
    link.href = withQuery(API_ROUTES.files.download, { path: item.path });
    link.download = item.name;
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();
    onMessage(`Download iniciado: ${item.name}`);
  }

  document.querySelector("#file-input").addEventListener("change", (event) => {
    uploadFiles(event.target.files);
    event.target.value = "";
  });

  return { downloadFile, uploadFiles };
}

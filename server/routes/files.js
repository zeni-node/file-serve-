const express = require("express");
const Busboy = require("busboy");
const path = require("node:path");
const { FileServiceError } = require("../services/fileService");

function receiveUpload(request, fileService, destination) {
  return new Promise((resolve, reject) => {
    let fileReceived = false;
    let uploadError = null;
    let uploadPromise = Promise.resolve();
    let parser;

    try {
      parser = Busboy({ headers: request.headers, limits: { files: 1 } });
    } catch (error) {
      reject(new FileServiceError("O envio precisa usar o formato multipart/form-data."));
      return;
    }

    parser.on("file", (fieldName, file, info) => {
      if (fileReceived || fieldName !== "file" || !info.filename) {
        uploadError = new FileServiceError("O envio não contém um arquivo válido.");
        file.resume();
        return;
      }

      fileReceived = true;
      uploadPromise = fileService.upload(destination, info.filename, file).catch((error) => {
        uploadError = error;
        file.resume();
      });
    });

    parser.on("filesLimit", () => {
      uploadError = new FileServiceError("Envie apenas um arquivo por vez.");
    });
    parser.once("error", reject);
    parser.once("close", async () => {
      await uploadPromise;
      if (uploadError) {
        reject(uploadError);
      } else if (!fileReceived) {
        reject(new FileServiceError("Nenhum arquivo foi enviado."));
      } else {
        resolve();
      }
    });
    request.pipe(parser);
  });
}

function createFileRoute(fileService, requireAuth) {
  const fileRoute = express.Router();

  fileRoute.get("/api/files", requireAuth, async (request, response) => {
    response.json(await fileService.list(request.query.path ?? ""));
  });

  fileRoute.post("/api/folder", requireAuth, async (request, response) => {
    await fileService.createFolder(request.body?.path, request.body?.name);
    response.status(201).json({ ok: true });
  });

  fileRoute.post("/api/file", requireAuth, async (request, response) => {
    await fileService.createFile(request.body?.path, request.body?.name);
    response.status(201).json({ ok: true });
  });

  fileRoute.post("/api/rename", requireAuth, async (request, response) => {
    await fileService.rename(request.body?.path, request.body?.name);
    response.json({ ok: true });
  });

  fileRoute.post("/api/delete", requireAuth, async (request, response) => {
    await fileService.delete(request.body?.path);
    response.json({ ok: true });
  });

  fileRoute.post("/api/copy", requireAuth, async (request, response) => {
    await fileService.copy(request.body?.path, request.body?.destination);
    response.json({ ok: true });
  });

  fileRoute.post("/api/move", requireAuth, async (request, response) => {
    await fileService.move(request.body?.path, request.body?.destination);
    response.json({ ok: true });
  });

  fileRoute.post("/api/upload", requireAuth, async (request, response) => {
    await receiveUpload(request, fileService, request.query.path ?? "");
    response.status(201).json({ ok: true });
  });

  fileRoute.get("/api/download", requireAuth, async (request, response, next) => {
    const file = await fileService.getFile(request.query.path);
    response.download(file.absolutePath, file.name, (error) => {
      if (error) {
        next(error);
      }
    });
  });

  fileRoute.get("/api/stream", requireAuth, async (request, response, next) => {
    const file = await fileService.getFile(request.query.path);
    const extension = path.extname(file.name).toLowerCase();
    const textExtensions = new Set([".txt", ".md", ".py", ".js", ".html", ".css", ".json", ".csv"]);

    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    if (textExtensions.has(extension)) {
      response.type("text/plain");
    }
    response.sendFile(file.absolutePath, (error) => {
      if (error) {
        next(error);
      }
    });
  });

  fileRoute.use((error, _request, response, next) => {
    if (error instanceof FileServiceError) {
      response.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  });

  return fileRoute;
}

module.exports = { createFileRoute };

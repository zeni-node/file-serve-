const fs = require("node:fs/promises");
const { constants } = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { pipeline } = require("node:stream/promises");

const MAX_ENTRY_NAME_LENGTH = 255;

class FileServiceError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "FileServiceError";
    this.statusCode = statusCode;
  }
}

class FileService {
  constructor({ repositoryPathProvider = async () => null } = {}) {
    this.repositoryPathProvider = repositoryPathProvider;
  }

  async getRootPath() {
    const configuredPath = await this.repositoryPathProvider();
    if (typeof configuredPath !== "string" || !configuredPath.trim()) {
      throw new FileServiceError("Selecione uma pasta de repositório no aplicativo.", 503);
    }

    let rootPath;
    try {
      rootPath = await fs.realpath(configuredPath);
      const rootStats = await fs.stat(rootPath);
      if (!rootStats.isDirectory()) {
        throw new FileServiceError("A pasta de repositório configurada não é válida.", 503);
      }
    } catch (error) {
      if (error instanceof FileServiceError) {
        throw error;
      }
      if (error.code === "ENOENT" || error.code === "ENOTDIR") {
        throw new FileServiceError("A pasta de repositório configurada não está disponível.", 503);
      }
      throw error;
    }

    return rootPath;
  }

  parseRelativePath(relativePath) {
    if (typeof relativePath !== "string") {
      throw new FileServiceError("O caminho informado não é válido.");
    }
    if (!relativePath) {
      return [];
    }
    if (path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
      throw new FileServiceError("O caminho deve ser relativo ao repositório.");
    }

    const segments = relativePath.split(/[\\/]+/);
    const reservedWindowsName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
    if (segments.some((segment) =>
      segment === "." ||
      segment === ".." ||
      segment.length > MAX_ENTRY_NAME_LENGTH ||
      /[<>:"|?*\u0000-\u001f]/.test(segment) ||
      /[. ]$/.test(segment) ||
      reservedWindowsName.test(segment)
    )) {
      throw new FileServiceError("O caminho informado não é permitido.");
    }
    return segments.filter(Boolean);
  }

  isPathWithin(parentPath, candidatePath) {
    const relativePath = path.relative(parentPath, candidatePath);
    return relativePath === "" ||
      (relativePath !== ".." &&
        !relativePath.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativePath));
  }

  validateEntryName(name) {
    if (typeof name !== "string") {
      throw new FileServiceError("Informe um nome válido.");
    }

    const normalizedName = name.trim();
    const reservedWindowsName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
    if (
      !normalizedName ||
      normalizedName.length > MAX_ENTRY_NAME_LENGTH ||
      normalizedName === "." ||
      normalizedName === ".." ||
      /[<>:"/\\|?*\u0000-\u001f]/.test(normalizedName) ||
      /[. ]$/.test(normalizedName) ||
      reservedWindowsName.test(normalizedName)
    ) {
      throw new FileServiceError("O nome informado não é válido.");
    }

    return normalizedName;
  }

  async resolvePath(rootPath, relativePath) {
    const segments = this.parseRelativePath(relativePath);
    let absolutePath = rootPath;
    let stats = await fs.lstat(rootPath);

    for (let index = 0; index < segments.length; index += 1) {
      absolutePath = path.join(absolutePath, segments[index]);
      try {
        stats = await fs.lstat(absolutePath);
      } catch (error) {
        if (error.code === "ENOENT" || error.code === "ENOTDIR") {
          throw new FileServiceError("O arquivo ou pasta não foi encontrado.", 404);
        }
        throw error;
      }

      if (stats.isSymbolicLink()) {
        throw new FileServiceError("Atalhos e links simbólicos não podem ser acessados.");
      }
      if (index < segments.length - 1 && !stats.isDirectory()) {
        throw new FileServiceError("O caminho informado não é uma pasta.");
      }
    }

    return { absolutePath, segments, stats };
  }

  async resolveDirectory(rootPath, relativePath) {
    const result = await this.resolvePath(rootPath, relativePath);
    if (!result.stats.isDirectory()) {
      throw new FileServiceError("O destino informado não é uma pasta.");
    }
    return result;
  }

  async resolveEntryParent(rootPath, relativePath, name) {
    const segments = this.parseRelativePath(relativePath);
    if (segments.length === 0) {
      throw new FileServiceError("Não é permitido alterar a pasta raiz.");
    }

    const entryName = this.validateEntryName(name);
    const parentPath = segments.slice(0, -1).join("/");
    const parent = await this.resolveDirectory(rootPath, parentPath);
    return {
      absolutePath: path.join(parent.absolutePath, entryName),
      parentPath: parent.absolutePath,
      entryName,
      parentSegments: parent.segments
    };
  }

  async resolveNewEntry(rootPath, directoryPath, name) {
    const directory = await this.resolveDirectory(rootPath, directoryPath);
    const entryName = this.validateEntryName(name);
    return {
      absolutePath: path.join(directory.absolutePath, entryName),
      parentPath: directory.absolutePath,
      entryName
    };
  }

  async assertDoesNotExist(absolutePath) {
    try {
      await fs.lstat(absolutePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }
      throw error;
    }
    throw new FileServiceError("Já existe um arquivo ou pasta com esse nome.", 409);
  }

  async list(relativePath = "") {
    const rootPath = await this.getRootPath();
    const directory = await this.resolveDirectory(rootPath, relativePath);
    const entries = await fs.readdir(directory.absolutePath, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }

      const absolutePath = path.join(directory.absolutePath, entry.name);
      const stats = await fs.lstat(absolutePath);
      if (!stats.isDirectory() && !stats.isFile()) {
        continue;
      }

      items.push({
        name: entry.name,
        path: [...directory.segments, entry.name].join("/"),
        is_folder: stats.isDirectory(),
        size: stats.isFile() ? stats.size : 0,
        modified: stats.mtime.toLocaleString("pt-BR")
      });
    }

    items.sort((left, right) => {
      if (left.is_folder !== right.is_folder) {
        return left.is_folder ? -1 : 1;
      }
      return left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" });
    });

    return { path: directory.segments.join("/"), items };
  }

  async createFolder(relativePath, name) {
    const rootPath = await this.getRootPath();
    const target = await this.resolveNewEntry(rootPath, relativePath, name);
    await this.assertDoesNotExist(target.absolutePath);
    await fs.mkdir(target.absolutePath);
  }

  async createFile(relativePath, name) {
    const rootPath = await this.getRootPath();
    const target = await this.resolveNewEntry(rootPath, relativePath, name);
    const handle = await fs.open(target.absolutePath, "wx");
    await handle.close();
  }

  async rename(relativePath, name) {
    const rootPath = await this.getRootPath();
    const source = await this.resolvePath(rootPath, relativePath);
    if (source.segments.length === 0) {
      throw new FileServiceError("Não é permitido renomear a pasta raiz.");
    }

    const target = await this.resolveEntryParent(
      rootPath,
      relativePath,
      this.validateEntryName(name)
    );
    if (source.absolutePath === target.absolutePath) {
      return;
    }
    await this.assertDoesNotExist(target.absolutePath);
    await fs.rename(source.absolutePath, target.absolutePath);
  }

  async delete(relativePath) {
    const rootPath = await this.getRootPath();
    const entry = await this.resolvePath(rootPath, relativePath);
    if (entry.segments.length === 0) {
      throw new FileServiceError("Não é permitido excluir a pasta raiz.");
    }
    await fs.rm(entry.absolutePath, { recursive: true });
  }

  async copy(relativePath, destinationPath) {
    const rootPath = await this.getRootPath();
    const source = await this.resolvePath(rootPath, relativePath);
    if (source.segments.length === 0) {
      throw new FileServiceError("Não é permitido copiar a pasta raiz.");
    }
    const destination = await this.resolveDirectory(rootPath, destinationPath);
    if (source.stats.isDirectory() && this.isPathWithin(source.absolutePath, destination.absolutePath)) {
      throw new FileServiceError("Não é possível copiar uma pasta para dentro dela mesma.");
    }

    const targetPath = path.join(destination.absolutePath, source.segments.at(-1));
    await this.assertDoesNotExist(targetPath);
    try {
      await this.copyEntry(source.absolutePath, targetPath);
    } catch (error) {
      await fs.rm(targetPath, { recursive: true, force: true });
      throw error;
    }
  }

  async copyEntry(sourcePath, targetPath) {
    const stats = await fs.lstat(sourcePath);
    if (stats.isSymbolicLink()) {
      throw new FileServiceError("Atalhos e links simbólicos não podem ser copiados.");
    }

    if (stats.isDirectory()) {
      await fs.mkdir(targetPath);
      const entries = await fs.readdir(sourcePath);
      for (const entryName of entries) {
        await this.copyEntry(
          path.join(sourcePath, entryName),
          path.join(targetPath, entryName)
        );
      }
      return;
    }

    if (!stats.isFile()) {
      throw new FileServiceError("Este tipo de arquivo não pode ser copiado.");
    }
    await fs.copyFile(sourcePath, targetPath, constants.COPYFILE_EXCL);
  }

  async move(relativePath, destinationPath) {
    const rootPath = await this.getRootPath();
    const source = await this.resolvePath(rootPath, relativePath);
    if (source.segments.length === 0) {
      throw new FileServiceError("Não é permitido mover a pasta raiz.");
    }
    const destination = await this.resolveDirectory(rootPath, destinationPath);
    if (source.stats.isDirectory() && this.isPathWithin(source.absolutePath, destination.absolutePath)) {
      throw new FileServiceError("Não é possível mover uma pasta para dentro dela mesma.");
    }

    const targetPath = path.join(destination.absolutePath, source.segments.at(-1));
    if (source.absolutePath === targetPath) {
      return;
    }
    await this.assertDoesNotExist(targetPath);
    try {
      await fs.rename(source.absolutePath, targetPath);
    } catch (error) {
      if (error.code !== "EXDEV") {
        throw error;
      }
      await this.copyEntry(source.absolutePath, targetPath);
      await fs.rm(source.absolutePath, { recursive: true });
    }
  }

  async getFile(relativePath) {
    const rootPath = await this.getRootPath();
    const file = await this.resolvePath(rootPath, relativePath);
    if (!file.stats.isFile()) {
      throw new FileServiceError("O caminho informado não é um arquivo.");
    }
    return {
      absolutePath: file.absolutePath,
      name: file.segments.at(-1),
      size: file.stats.size
    };
  }

  async upload(relativePath, name, inputStream) {
    const rootPath = await this.getRootPath();
    const directory = await this.resolveDirectory(rootPath, relativePath);
    const entryName = this.validateEntryName(name);
    const targetPath = path.join(directory.absolutePath, entryName);
    const temporaryPath = path.join(directory.absolutePath, `.upload-${randomUUID()}.tmp`);

    try {
      await pipeline(
        inputStream,
        require("node:fs").createWriteStream(temporaryPath, { flags: "wx" })
      );
      await this.assertDoesNotExist(targetPath);
      await fs.link(temporaryPath, targetPath);
    } catch (error) {
      if (error.code === "EEXIST") {
        throw new FileServiceError("Já existe um arquivo ou pasta com esse nome.", 409);
      }
      throw error;
    } finally {
      await fs.rm(temporaryPath, { force: true });
    }
  }
}

module.exports = { FileService, FileServiceError };

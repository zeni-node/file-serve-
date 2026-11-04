const { readFile } = require("node:fs/promises");
const path = require("node:path");

function parseServerConfig(contents, filePath) {
  let config;
  try {
    config = JSON.parse(contents);
  } catch (error) {
    throw new Error(`O arquivo de configuração "${filePath}" não contém JSON válido.`, {
      cause: error
    });
  }

  if (
    !config ||
    typeof config !== "object" ||
    Array.isArray(config) ||
    typeof config.password !== "string"
  ) {
    throw new Error(
      `O arquivo de configuração "${filePath}" precisa conter o campo "password" como texto.`
    );
  }

  return { password: config.password };
}

async function readServerConfig({ directory }) {
  const configPath = path.join(directory, "server.json");
  const contents = await readFile(configPath, "utf8");
  return parseServerConfig(contents, configPath);
}

module.exports = { readServerConfig };

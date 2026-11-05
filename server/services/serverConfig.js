const { mkdir, readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { DEVICE_TYPES } = require("./presenceService");
const { MAX_PASSWORD_LENGTH } = require("./authService");

const DEFAULT_MAX_USERS = 25;
const DEFAULT_ALLOWED_DEVICE_TYPES = [...DEVICE_TYPES];

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

  const maxUsers = config.maxUsers ?? DEFAULT_MAX_USERS;
  if (!Number.isInteger(maxUsers) || maxUsers < 1 || maxUsers > DEFAULT_MAX_USERS) {
    throw new Error(
      `O campo "maxUsers" no arquivo "${filePath}" deve ser um número inteiro entre 1 e ${DEFAULT_MAX_USERS}.`
    );
  }

  const allowedDeviceTypes = config.allowedDeviceTypes ?? DEFAULT_ALLOWED_DEVICE_TYPES;
  if (
    !Array.isArray(allowedDeviceTypes) ||
    allowedDeviceTypes.some((deviceType) => !DEVICE_TYPES.has(deviceType))
  ) {
    throw new Error(
      `O campo "allowedDeviceTypes" no arquivo "${filePath}" deve conter apenas tipos de dispositivo válidos.`
    );
  }

  return {
    password: config.password,
    maxUsers,
    allowedDeviceTypes: [...new Set(allowedDeviceTypes)]
  };
}

async function readServerConfig({ directory }) {
  const configPath = path.join(directory, "server.json");
  const contents = await readFile(configPath, "utf8");
  return parseServerConfig(contents, configPath);
}

async function saveServerSettings({
  directory,
  maxUsers,
  allowedDeviceTypes,
  password
}) {
  if (
    !Number.isInteger(maxUsers) ||
    !Array.isArray(allowedDeviceTypes) ||
    (password !== undefined &&
      (typeof password !== "string" ||
        password.length === 0 ||
        password.length > MAX_PASSWORD_LENGTH))
  ) {
    throw new TypeError(
      `Informe configurações válidas e, se fornecida, uma senha entre 1 e ${MAX_PASSWORD_LENGTH} caracteres.`
    );
  }

  const configPath = path.join(directory, "server.json");
  const currentConfig = await readServerConfig({ directory });
  const config = parseServerConfig(JSON.stringify({
    password: password ?? currentConfig.password,
    maxUsers,
    allowedDeviceTypes
  }), configPath);

  await mkdir(directory, { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return {
    maxUsers: config.maxUsers,
    allowedDeviceTypes: config.allowedDeviceTypes,
    hasPassword: config.password.length > 0
  };
}

module.exports = {
  DEFAULT_ALLOWED_DEVICE_TYPES,
  DEFAULT_MAX_USERS,
  readServerConfig,
  saveServerSettings
};

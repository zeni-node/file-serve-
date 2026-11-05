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

  const passwordEnabled = config.passwordEnabled ?? config.password.length > 0;
  if (typeof passwordEnabled !== "boolean") {
    throw new Error(
      `O campo "passwordEnabled" no arquivo "${filePath}" deve ser verdadeiro ou falso.`
    );
  }
  const maxUsers = config.maxUsers ?? DEFAULT_MAX_USERS;
  if (!Number.isInteger(maxUsers) || maxUsers < 1 || maxUsers > DEFAULT_MAX_USERS) {
    throw new Error(
      `O campo "maxUsers" no arquivo "${filePath}" deve ser um número inteiro entre 1 e ${DEFAULT_MAX_USERS}.`
    );
  }

  const maxUsersEnabled = config.maxUsersEnabled ?? (
    config.maxUsers !== undefined && config.maxUsers < DEFAULT_MAX_USERS
  );
  if (typeof maxUsersEnabled !== "boolean") {
    throw new Error(
      `O campo "maxUsersEnabled" no arquivo "${filePath}" deve ser verdadeiro ou falso.`
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
  const normalizedAllowedDeviceTypes = [...new Set(allowedDeviceTypes)];
  const allowedDeviceTypesEnabled = config.allowedDeviceTypesEnabled ?? (
    config.allowedDeviceTypes !== undefined &&
    normalizedAllowedDeviceTypes.length < DEVICE_TYPES.size
  );
  if (typeof allowedDeviceTypesEnabled !== "boolean") {
    throw new Error(
      `O campo "allowedDeviceTypesEnabled" no arquivo "${filePath}" deve ser verdadeiro ou falso.`
    );
  }
  if (allowedDeviceTypesEnabled && normalizedAllowedDeviceTypes.length === 0) {
    throw new Error(
      `O campo "allowedDeviceTypes" no arquivo "${filePath}" deve conter pelo menos um tipo de dispositivo permitido quando o filtro estiver ativado.`
    );
  }

  return {
    password: config.password,
    passwordEnabled,
    maxUsers,
    maxUsersEnabled,
    allowedDeviceTypes: normalizedAllowedDeviceTypes,
    allowedDeviceTypesEnabled
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
  maxUsersEnabled,
  allowedDeviceTypesEnabled,
  password,
  passwordEnabled
}) {
  if (
    !Number.isInteger(maxUsers) ||
    !Array.isArray(allowedDeviceTypes) ||
    (password !== undefined &&
      (typeof password !== "string" ||
        password.length > MAX_PASSWORD_LENGTH)) ||
    (passwordEnabled !== undefined && typeof passwordEnabled !== "boolean") ||
    (maxUsersEnabled !== undefined && typeof maxUsersEnabled !== "boolean") ||
    (allowedDeviceTypesEnabled !== undefined &&
      typeof allowedDeviceTypesEnabled !== "boolean")
  ) {
    throw new TypeError(
      `Informe configurações válidas e, se fornecida, uma senha com no máximo ${MAX_PASSWORD_LENGTH} caracteres e um estado de senha válido.`
    );
  }

  const configPath = path.join(directory, "server.json");
  const currentConfig = await readServerConfig({ directory });
  const nextPassword = password || currentConfig.password;
  const nextMaxUsersEnabled = maxUsersEnabled ?? (
    maxUsers === currentConfig.maxUsers
      ? currentConfig.maxUsersEnabled
      : true
  );
  const config = parseServerConfig(JSON.stringify({
    password: nextPassword,
    passwordEnabled: passwordEnabled ?? (
      password ? true : currentConfig.passwordEnabled
    ),
    maxUsers,
    maxUsersEnabled: nextMaxUsersEnabled,
    allowedDeviceTypes,
    allowedDeviceTypesEnabled: allowedDeviceTypesEnabled ??
      currentConfig.allowedDeviceTypesEnabled
  }), configPath);

  await mkdir(directory, { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return {
    maxUsers: config.maxUsers,
    maxUsersEnabled: config.maxUsersEnabled,
    allowedDeviceTypes: config.allowedDeviceTypes,
    allowedDeviceTypesEnabled: config.allowedDeviceTypesEnabled,
    hasPassword: config.passwordEnabled,
    hasSavedPassword: config.password.length > 0
  };
}

module.exports = {
  DEFAULT_ALLOWED_DEVICE_TYPES,
  DEFAULT_MAX_USERS,
  readServerConfig,
  saveServerSettings
};

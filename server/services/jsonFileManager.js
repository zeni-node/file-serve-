const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");

const JSON_FILES = [
  {
    name: "server.json",
    createDefault: () => ({
      password: "",
      maxUsers: 25,
      allowedDeviceTypes: ["mobile", "tablet", "computer", "tv", "unknown"]
    })
  },
  {
    name: "repository.json",
    createDefault: ({ repositoryPath }) => ({ repositoryPath })
  }
];

async function ensureJsonFiles({ directory, repositoryPath = null }) {
  await mkdir(directory, { recursive: true });

  for (const jsonFile of JSON_FILES) {
    const filePath = path.join(directory, jsonFile.name);
    const contents = `${JSON.stringify(jsonFile.createDefault({ repositoryPath }), null, 2)}\n`;

    try {
      await writeFile(filePath, contents, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
  }
}

async function saveRepositoryPath({ directory, repositoryPath }) {
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, "repository.json");
  await writeFile(filePath, `${JSON.stringify({ repositoryPath }, null, 2)}\n`, "utf8");
}

module.exports = { JSON_FILES, ensureJsonFiles, saveRepositoryPath };

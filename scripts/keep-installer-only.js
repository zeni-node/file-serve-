const fs = require("node:fs");
const path = require("node:path");

const packageJson = require("../package.json");
const outputDirectory = path.resolve(__dirname, "..", packageJson.build.directories.output);
const releaseDirectory = path.dirname(outputDirectory);
const installerName = `${packageJson.build.productName}-Setup-${packageJson.version}.exe`;
const installerPath = path.join(outputDirectory, installerName);
const releaseInstallerPath = path.join(releaseDirectory, installerName);

if (!fs.existsSync(installerPath) || !fs.statSync(installerPath).isFile()) {
  throw new Error(`O instalador esperado não foi encontrado: ${installerPath}`);
}

fs.mkdirSync(releaseDirectory, { recursive: true });
fs.copyFileSync(installerPath, releaseInstallerPath);

for (const entry of fs.readdirSync(releaseDirectory, { withFileTypes: true })) {
  if (
    entry.isFile() &&
    /^.+-Setup-[0-9][0-9.]*\.exe$/i.test(entry.name) &&
    path.join(releaseDirectory, entry.name) !== releaseInstallerPath
  ) {
    fs.rmSync(path.join(releaseDirectory, entry.name), { force: true });
  }
}

fs.rmSync(outputDirectory, { recursive: true, force: true });

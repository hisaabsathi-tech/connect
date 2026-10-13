/** biome-ignore-all lint/suspicious/noConsole: this command reports generated files */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";
import { PNG } from "pngjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseDirectory = resolve(root, "assets/logo/base");
const outputDirectory = resolve(root, "assets/logo/android");
const splashDirectory = resolve(root, "assets/logo/splash");
const splashSourcePath = resolve(splashDirectory, "dark.svg");
const outputSize = 1024;
const artworkScale = 0.8;
const splashArtworkScale = 0.64;
const splashBackground = [249, 251, 255];

const requestedSource = process.argv.find((argument) => argument.startsWith("--source="));
const requestedFilename = requestedSource?.slice("--source=".length);

if (requestedFilename?.includes("/") || requestedFilename?.includes("\\")) {
  throw new Error("--source must be app.svg or app.png");
}

const sourceCandidates = requestedFilename ? [requestedFilename] : ["app.svg", "app.png"];
const sourceFilename = sourceCandidates.find((filename) =>
  existsSync(resolve(baseDirectory, filename)),
);

if (!sourceFilename) {
  throw new Error(`Add app.svg or app.png to ${baseDirectory}, then run this command again.`);
}

if (!new Set(["app.svg", "app.png"]).has(sourceFilename)) {
  throw new Error("--source must be app.svg or app.png");
}

const sourcePath = resolve(baseDirectory, sourceFilename);

function renderSvg(path, width) {
  const rendered = new Resvg(readFileSync(path, "utf8"), {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: false },
    shapeRendering: 2,
  }).render();
  return PNG.sync.read(rendered.asPng());
}

function decodeSource() {
  if (extname(sourcePath) === ".svg") {
    return renderSvg(sourcePath, outputSize);
  }

  return PNG.sync.read(readFileSync(sourcePath));
}

function createPng(width = outputSize, height = outputSize) {
  return new PNG({ width, height });
}

function pixelOffset(image, x, y) {
  return (image.width * y + x) * 4;
}

function readPixel(image, x, y) {
  const offset = pixelOffset(image, x, y);
  return [
    image.data[offset],
    image.data[offset + 1],
    image.data[offset + 2],
    image.data[offset + 3],
  ];
}

function writePixel(image, x, y, color) {
  const offset = pixelOffset(image, x, y);
  image.data[offset] = color[0];
  image.data[offset + 1] = color[1];
  image.data[offset + 2] = color[2];
  image.data[offset + 3] = color[3];
}

function resizeSquare(source, size) {
  if (source.width !== source.height) {
    throw new Error(`${sourceFilename} must be square; received ${source.width}x${source.height}.`);
  }

  if (source.width === size) {
    return source;
  }

  const output = createPng(size, size);
  const scale = source.width / size;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor((x + 0.5) * scale));
      const sourceY = Math.min(source.height - 1, Math.floor((y + 0.5) * scale));
      writePixel(output, x, y, readPixel(source, sourceX, sourceY));
    }
  }

  return output;
}

function dominantBackground(image) {
  const colors = new Map();

  for (let y = 0; y < image.height; y += 4) {
    for (let x = 0; x < image.width; x += 4) {
      const [red, green, blue, alpha] = readPixel(image, x, y);
      if (alpha < 240) {
        continue;
      }

      const color = [red, green, blue];
      const key = color.join(",");
      colors.set(key, (colors.get(key) ?? 0) + 1);
    }
  }

  const mostCommon = [...colors.entries()].sort((left, right) => right[1] - left[1])[0];
  if (!mostCommon) {
    throw new Error(`${sourceFilename} does not contain any opaque artwork.`);
  }

  return mostCommon[0].split(",").map(Number);
}

function fill(image, color) {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      writePixel(image, x, y, color);
    }
  }
}

function compositeCentered(destination, source) {
  const startX = Math.round((destination.width - source.width) / 2);
  const startY = Math.round((destination.height - source.height) / 2);

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceColor = readPixel(source, x, y);
      const alpha = sourceColor[3] / 255;
      const destinationColor = readPixel(destination, startX + x, startY + y);
      writePixel(destination, startX + x, startY + y, [
        Math.round(sourceColor[0] * alpha + destinationColor[0] * (1 - alpha)),
        Math.round(sourceColor[1] * alpha + destinationColor[1] * (1 - alpha)),
        Math.round(sourceColor[2] * alpha + destinationColor[2] * (1 - alpha)),
        Math.round(sourceColor[3] + destinationColor[3] * (1 - alpha)),
      ]);
    }
  }
}

function deriveMonochrome(source, background) {
  const output = createPng(source.width, source.height);

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const color = readPixel(source, x, y);
      const distance = Math.sqrt(
        (color[0] - background[0]) ** 2 +
          (color[1] - background[1]) ** 2 +
          (color[2] - background[2]) ** 2,
      );
      const differenceAlpha = Math.max(0, Math.min(1, (distance - 8) / 40));
      writePixel(output, x, y, [255, 255, 255, Math.round(color[3] * differenceAlpha)]);
    }
  }

  return output;
}

function toHex(color) {
  return `#${color.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function writePng(filename, image) {
  writeFileSync(resolve(outputDirectory, filename), PNG.sync.write(image));
}

function writeSplashPng(filename, image) {
  writeFileSync(resolve(splashDirectory, filename), PNG.sync.write(image));
}

const source = resizeSquare(decodeSource(), outputSize);
const background = dominantBackground(source);
const artworkSize = Math.round(outputSize * artworkScale);
const artwork = resizeSquare(source, artworkSize);
const monochromeArtwork = resizeSquare(deriveMonochrome(source, background), artworkSize);

const appIcon = createPng();
fill(appIcon, [...background, 255]);
compositeCentered(appIcon, artwork);

const adaptiveBackground = createPng();
fill(adaptiveBackground, [...background, 255]);

const adaptiveMonochrome = createPng();
fill(adaptiveMonochrome, [255, 255, 255, 0]);
compositeCentered(adaptiveMonochrome, monochromeArtwork);

if (!existsSync(splashSourcePath)) {
  throw new Error(`Add dark.svg to ${splashDirectory}, then run this command again.`);
}

const splash = createPng();
fill(splash, [...splashBackground, 255]);
compositeCentered(splash, renderSvg(splashSourcePath, Math.round(outputSize * splashArtworkScale)));

mkdirSync(outputDirectory, { recursive: true });
writePng("app.png", appIcon);
writePng("adaptive-background.png", adaptiveBackground);
writePng("adaptive-foreground.png", appIcon);
writePng("adaptive-monochrome.png", adaptiveMonochrome);
writeSplashPng("dark.png", splash);
rmSync(resolve(outputDirectory, "splash.png"), { force: true });
writeFileSync(
  resolve(outputDirectory, "metadata.json"),
  `${JSON.stringify(
    {
      backgroundColor: toHex(background),
      generatedFrom: `assets/logo/base/${sourceFilename}`,
      splashBackgroundColor: toHex(splashBackground),
      splashGeneratedFrom: "assets/logo/splash/dark.svg",
    },
    null,
    2,
  )}\n`,
);

console.log(
  `Generated Android logo assets from assets/logo/base/${sourceFilename} and splash artwork from assets/logo/splash/dark.svg.`,
);

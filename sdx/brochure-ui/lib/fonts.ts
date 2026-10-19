import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { createReadStream } from "node:fs";
import { Extract } from "unzipper";

const FONT_URL =
  "https://www2.gov.bc.ca/assets/gov/british-columbians-our-governments/services-policies-for-government/policies-procedures-standards/web-content-development-guides/corporate-identity-assets/bcsansfont_web.zip?forcedownload=true";
const DOWNLOAD_PATH = "/tmp/bcsansfont_web.zip";
const EXTRACT_PATH = "/tmp/bcsansfont_web";
const PUBLIC_FONTS_PATH = "./public/fonts";

// public/css/BC_Sans.css loads these names; one of them present means the
// fonts were installed (normally at image build time).
const SENTINEL_FONT = "BCSans-Regular.woff2";

export function fontsInstalled(): boolean {
  return fs.existsSync(path.join(PUBLIC_FONTS_PATH, SENTINEL_FONT));
}

// Downloads BC Sans and copies it into public/fonts. Throws on any failure.
// The Docker build runs this (see `import.meta.main` below), so a published
// image already contains the fonts and never needs the network for them.
export async function downloadAndSetupFonts(): Promise<void> {
  // Download the font file
  await downloadFile(FONT_URL, DOWNLOAD_PATH);

  // Ensure extract directory exists
  if (!fs.existsSync(EXTRACT_PATH)) {
    fs.mkdirSync(EXTRACT_PATH, { recursive: true });
  }

  // Unzip the file
  await unzipFile(DOWNLOAD_PATH, EXTRACT_PATH);

  // Ensure public fonts directory exists
  if (!fs.existsSync(PUBLIC_FONTS_PATH)) {
    fs.mkdirSync(PUBLIC_FONTS_PATH, { recursive: true });
  }

  // Copy font files to public folder
  copyFontsToPublic(EXTRACT_PATH, PUBLIC_FONTS_PATH);

  if (!fontsInstalled()) {
    throw new Error(
      `Font archive did not contain ${SENTINEL_FONT}; check normalizeFontName against the archive contents`,
    );
  }

  console.log("Fonts downloaded and setup successfully");
}

// Startup hook. Uses the fonts baked into the image; when running from source
// without them, tries a download but never stops the server if it fails. The
// UI falls back to system fonts until the next successful start.
export async function ensureFonts(): Promise<void> {
  if (fontsInstalled()) return;
  try {
    await downloadAndSetupFonts();
  } catch (error) {
    console.warn(
      "BC Sans fonts unavailable; continuing with fallback fonts:",
      error,
    );
  }
}

function downloadFile(
  url: string,
  filepath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const fail = (err: Error) => {
      fs.unlink(filepath, () => {});
      reject(err);
    };
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          fail(
            new Error(
              `Font download failed with HTTP ${response.statusCode}`,
            ),
          );
          return;
        }
        const file = fs.createWriteStream(filepath);
        response.on("error", fail);
        file.on("error", fail);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        response.pipe(file);
      })
      .on("error", fail);
  });
}

function unzipFile(
  filepath: string,
  extractPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    createReadStream(filepath)
      .pipe(Extract({ path: extractPath }))
      .on("finish", resolve)
      .on("error", reject);
  });
}

// Strip the date prefix and version suffix from the distributed font file
// names so they match the references in public/css/BC_Sans.css, e.g.
// "2023_01_01_BCSans-Regular_2f.woff2" -> "BCSans-Regular.woff2".
function normalizeFontName(filename: string): string {
  const match = filename.match(
    /(BCSans-[A-Za-z]+)_[0-9a-z]+(\.[a-z0-9]+)$/i,
  );
  return match ? `${match[1]}${match[2]}` : filename;
}

function copyFontsToPublic(
  sourceDir: string,
  destDir: string,
): void {
  const files = fs.readdirSync(sourceDir, {
    recursive: true,
  });

  files.forEach((file) => {
    const sourcePath = path.join(sourceDir, file as string);
    const destPath = path.join(
      destDir,
      normalizeFontName(path.basename(file as string)),
    );

    if (fs.statSync(sourcePath).isFile()) {
      fs.copyFileSync(sourcePath, destPath);
    }
  });
}

// `deno run lib/fonts.ts` (used by the Dockerfile) installs the fonts and
// exits non-zero on failure, so a bad download fails the image build instead
// of every container start.
if (import.meta.main) {
  await downloadAndSetupFonts();
}

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

export async function downloadAndSetupFonts(): Promise<void> {
  try {
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

    console.log("Fonts downloaded and setup successfully");
  } catch (error) {
    console.error(
      "Error downloading and setting up fonts:",
      error,
    );
    throw error;
  }
}

function downloadFile(
  url: string,
  filepath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https
      .get(url, (response) => {
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
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

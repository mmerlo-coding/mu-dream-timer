import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const rootDir = path.resolve(import.meta.dirname, "..");
const sourceDir = path.join(rootDir, "assets", "source");
const outputDir = path.join(rootDir, "assets", "bosses");

type CropJob = {
  sourceFile: string;
  columns: number;
  bossIds: string[];
  topRatio?: number;
};

const jobs: CropJob[] = [
  {
    sourceFile: "mini-bosses.png",
    columns: 4,
    bossIds: ["muggron", "kharzul", "vescrya", "borgar"],
  },
  {
    sourceFile: "heroes.png",
    columns: 2,
    bossIds: ["heroe-explorador", "heroe-hombre-lobo"],
  },
  {
    sourceFile: "goblins.png",
    columns: 3,
    bossIds: ["goblin-azul", "goblin-rojo", "goblin-amarillo"],
  },
  {
    sourceFile: "dragon.png",
    columns: 1,
    bossIds: ["dragon-rojo"],
  },
  {
    sourceFile: "world-bosses.png",
    columns: 4,
    bossIds: [
      "abbadon",
      "lord-kundun-shadow",
      "lord-kundun-kanturu",
      "senor-supremo-infernal",
    ],
  },
];

async function cropColumns(job: CropJob) {
  const sourcePath = path.join(sourceDir, job.sourceFile);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source image: ${sourcePath}`);
  }

  const image = sharp(sourcePath);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const columnWidth = Math.floor(width / job.columns);
  const cropHeight = Math.floor(height * (job.topRatio ?? 0.42));

  for (let index = 0; index < job.bossIds.length; index += 1) {
    const bossId = job.bossIds[index];
    const left = index * columnWidth;
    const outputPath = path.join(outputDir, `${bossId}.png`);

    await sharp(sourcePath)
      .extract({
        left,
        top: 0,
        width: columnWidth,
        height: cropHeight,
      })
      .resize(320, 320, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(outputPath);

    console.log(`Created ${outputPath}`);
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const job of jobs) {
    await cropColumns(job);
  }

  console.log("All boss images cropped successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

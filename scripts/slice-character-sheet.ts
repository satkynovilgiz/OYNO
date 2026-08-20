/**
 * Reusable pipeline for slicing a character expression sheet (a cols x rows
 * grid of circular/oval portraits, e.g. from Gemini) into individual
 * transparent, circularly-masked 512x512 PNGs.
 *
 * Handles .jfif input directly (jimp's JPEG decoder reads it like any other
 * JPEG - .jfif is just a JPEG file with a specific marker, no separate
 * "conversion" step is actually needed beyond re-encoding to PNG on save,
 * which happens naturally since we always write .png output).
 *
 * Usage:
 *   npx tsx scripts/slice-character-sheet.ts \
 *     --source assets/img/reference/aidana.jfif \
 *     --character aidana \
 *     --cols 4 --rows 2 \
 *     --emotions happy,laughing,angry,sad,surprised,focused,winking,thinking \
 *     --preview
 *
 * Options:
 *   --source <path>            Source sheet image (.jfif/.jpg/.png/...).
 *   --character <name>         Character id, used for the output folder and
 *                               filename prefix.
 *   --cols <n> --rows <n>      Grid size (sheets have come in as 4x2 and 4x3).
 *   --emotions <a,b,c,...>     Ordered emotion names, one per grid cell,
 *                               row-major (left-to-right, top-to-bottom). If
 *                               fewer names than cells are given, only that
 *                               many cells (from the start) are processed -
 *                               useful for a 4x3 sheet where only 8 of the 12
 *                               cells are meaningfully distinct.
 *   --crop-tightness <0-1>     Fraction of the cell's shorter side kept as the
 *                               square crop before circular masking (default
 *                               0.82). Different sheets frame the oval
 *                               differently, so tune per sheet if the circle
 *                               clips the face or includes checker/background.
 *   --vertical-anchor <0-1>    Where in the cell (0 = top, 1 = bottom) the
 *                               crop is centered vertically (default 0.5).
 *                               Lower this (e.g. ~0.42) for sheets that have a
 *                               text label baked in under each portrait, so
 *                               the label doesn't get pulled into the crop.
 *   --out-dir <path>           Output root (default assets/characters).
 *   --preview                  Also write a labeled contact-sheet PNG next to
 *                               the output folder for visual QA before
 *                               committing a batch.
 */
import fs from 'node:fs';
import path from 'node:path';

import { Jimp, loadFont } from 'jimp';
import { SANS_16_BLACK } from '@jimp/plugin-print/fonts';

type Args = {
  source: string;
  character: string;
  cols: number;
  rows: number;
  emotions: string[];
  cropTightness: number;
  verticalAnchor: number;
  outDir: string;
  preview: boolean;
};

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };

  const source = get('--source');
  const character = get('--character');
  const cols = Number(get('--cols'));
  const rows = Number(get('--rows'));
  const emotionsRaw = get('--emotions');

  if (!source || !character || !cols || !rows || !emotionsRaw) {
    console.error(
      'Required: --source <path> --character <name> --cols <n> --rows <n> --emotions <a,b,c,...>',
    );
    process.exit(1);
  }

  return {
    source,
    character,
    cols,
    rows,
    emotions: emotionsRaw.split(',').map((e) => e.trim()).filter(Boolean),
    cropTightness: Number(get('--crop-tightness') ?? 0.82),
    verticalAnchor: Number(get('--vertical-anchor') ?? 0.5),
    outDir: get('--out-dir') ?? 'assets/characters',
    preview: argv.includes('--preview'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const outDir = path.join(args.outDir, args.character);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Reading ${args.source}...`);
  const sheet = await Jimp.read(args.source);

  const cellW = sheet.bitmap.width / args.cols;
  const cellH = sheet.bitmap.height / args.rows;
  const cellCount = args.cols * args.rows;
  const count = Math.min(args.emotions.length, cellCount);

  if (args.emotions.length !== cellCount) {
    console.warn(
      `Note: sheet has ${cellCount} cells but ${args.emotions.length} emotion names were given - processing the first ${count} cell(s) only.`,
    );
  }

  const outputs: { emotion: string; buffer: Buffer }[] = [];

  for (let i = 0; i < count; i++) {
    const col = i % args.cols;
    const row = Math.floor(i / args.cols);
    const cellX = col * cellW;
    const cellY = row * cellH;

    const cropSize = Math.min(cellW, cellH) * args.cropTightness;
    const centerX = cellX + cellW / 2;
    const centerY = cellY + cellH * args.verticalAnchor;

    // Clamp so the crop never reads outside this cell's bounds.
    const cropX = Math.min(Math.max(centerX - cropSize / 2, cellX), cellX + cellW - cropSize);
    const cropY = Math.min(Math.max(centerY - cropSize / 2, cellY), cellY + cellH - cropSize);

    const emotion = args.emotions[i];
    const cell = sheet.clone().crop({
      x: Math.round(cropX),
      y: Math.round(cropY),
      w: Math.round(cropSize),
      h: Math.round(cropSize),
    });
    cell.circle();
    cell.resize({ w: 512, h: 512 });

    const outPath = path.join(outDir, `${args.character}_${emotion}.png`);
    const buffer = await cell.getBuffer('image/png');
    fs.writeFileSync(outPath, buffer);
    console.log(`  saved ${outPath}`);
    outputs.push({ emotion, buffer });
  }

  if (args.preview) {
    await writeContactSheet(args.character, outputs, args.outDir);
  }

  console.log(`Done: ${count} emotion(s) sliced for "${args.character}".`);
}

async function writeContactSheet(
  character: string,
  outputs: { emotion: string; buffer: Buffer }[],
  outRoot: string,
) {
  const thumb = 160;
  const labelH = 24;
  const pad = 14;
  const cols = Math.min(4, outputs.length) || 1;
  const rows = Math.ceil(outputs.length / cols);

  const sheetW = cols * thumb + (cols + 1) * pad;
  const sheetH = rows * (thumb + labelH) + (rows + 1) * pad;

  const contact = new Jimp({ width: sheetW, height: sheetH, color: 0xffffffff });
  const font = await loadFont(SANS_16_BLACK);

  for (let i = 0; i < outputs.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = pad + col * (thumb + pad);
    const y = pad + row * (thumb + labelH + pad);

    const thumbImg = (await Jimp.read(outputs[i].buffer)).resize({ w: thumb, h: thumb });
    contact.blit({ src: thumbImg, x, y });
    contact.print({ font, x, y: y + thumb + 2, text: outputs[i].emotion });
  }

  const outPath = path.join(outRoot, `${character}_contact_sheet.png`);
  const buffer = await contact.getBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  console.log(`Preview contact sheet: ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

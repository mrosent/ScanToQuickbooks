import * as VideoThumbnails from "expo-video-thumbnails";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import jpeg from "jpeg-js";
import { Buffer } from "buffer";

const FRAME_INTERVAL_MS = 500;
const MAX_CANDIDATE_FRAMES = 40;
const MAX_FRAMES = 10;
const FRAMES_PER_HALF = 5;
// Balance: reduce overlap from ~80% but keep enough frames for full receipt coverage.
// ~47% different (53% overlap) = threshold 30. Tune 25–35 if needed.
const SIMILARITY_THRESHOLD = 30; // Keep frame when Hamming distance > 30 (0-64 scale)

/** Difference hash (dHash) - more sensitive to scroll/position changes than average hash. */
async function differenceHash(imageUri: string): Promise<bigint> {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const buf = Buffer.from(base64, "base64");
  const decoded = jpeg.decode(buf, { useTArray: true });
  const { width, height, data } = decoded;
  const w = 9;
  const h = 8;
  const gray: number[] = [];
  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const x = Math.floor((sx + 0.5) * (width / w));
      const y = Math.floor((sy + 0.5) * (height / h));
      const i = (y * width + x) * 4;
      const g = (data[i] + data[i + 1] + data[i + 2]) / 3;
      gray.push(g);
    }
  }
  let hash = 0n;
  let bit = 0;
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w - 1; col++) {
      const left = gray[row * w + col];
      const right = gray[row * w + col + 1];
      if (left > right) hash |= 1n << BigInt(63 - bit);
      bit++;
    }
  }
  return hash;
}

/** Hamming distance between two 64-bit hashes. */
function hammingDistance(a: bigint, b: bigint): number {
  let d = 0;
  let x = a ^ b;
  while (x) {
    d += Number(x & 1n);
    x >>= 1n;
  }
  return d;
}

/** Get video duration in milliseconds using expo-av */
async function getVideoDurationMs(videoUri: string): Promise<number> {
  try {
    const { sound } = await Audio.Sound.createAsync({ uri: videoUri });
    try {
      const status = await sound.getStatusAsync();
      if (status && "durationMillis" in status && typeof status.durationMillis === "number") {
        return Math.max(0, status.durationMillis);
      }
    } finally {
      await sound.unloadAsync();
    }
  } catch {
    // Fallback: assume 10s if we can't get duration
  }
  return 10000;
}

/** Extract frames from video at intervals. Filters by similarity to keep ~4–8 unique overlapping frames. */
export async function sampleVideoFrames(videoUri: string): Promise<string[]> {
  const durationMs = await getVideoDurationMs(videoUri);
  const dir = `${FileSystem.cacheDirectory}video_frames_${Date.now()}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  const timestamps: number[] = [];
  for (let t = 0; t < durationMs && timestamps.length < MAX_CANDIDATE_FRAMES; t += FRAME_INTERVAL_MS) {
    timestamps.push(t);
  }

  const candidates: string[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: timestamps[i],
        quality: 1,
      });
      const ext = uri.toLowerCase().includes(".png") ? "png" : "jpg";
      const destUri = `${dir}frame_${i}.${ext}`;
      await FileSystem.copyAsync({ from: uri, to: destUri });
      candidates.push(destUri);
    } catch {
      break;
    }
  }

  return filterBySimilarityWithSpread(candidates);
}

/** Filter each half of the video separately so we get coverage from start AND end. */
async function filterBySimilarityWithSpread(uris: string[]): Promise<string[]> {
  if (uris.length <= 1) return uris;

  const mid = Math.ceil(uris.length / 2);
  const firstHalf = uris.slice(0, mid);
  const secondHalf = uris.slice(mid);

  const fromFirst = await filterSequence(firstHalf, FRAMES_PER_HALF);
  const fromSecond = await filterSequence(secondHalf, FRAMES_PER_HALF);

  const combined = [...fromFirst, ...fromSecond];
  return combined.slice(0, MAX_FRAMES);
}

/** Keep only frames that differ enough from the previous kept frame. */
async function filterSequence(uris: string[], maxKeep: number): Promise<string[]> {
  if (uris.length === 0) return [];
  if (uris.length === 1) return uris;

  const kept: string[] = [uris[0]];
  let lastHash: bigint;
  try {
    lastHash = await differenceHash(uris[0]);
  } catch {
    return uris.slice(0, maxKeep);
  }

  for (let i = 1; i < uris.length && kept.length < maxKeep; i++) {
    try {
      const hash = await differenceHash(uris[i]);
      const dist = hammingDistance(hash, lastHash);
      if (dist > SIMILARITY_THRESHOLD) {
        kept.push(uris[i]);
        lastHash = hash;
      }
    } catch {
      kept.push(uris[i]);
    }
  }

  return kept;
}

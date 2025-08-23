// Local storage helpers for stream tracking and clip creation

const STREAM_DATA_KEY = "vivoor.stream.data";
const STREAM_START_DAA_KEY = "vivoor.stream.startDaa";

export interface StreamTrackingData {
  streamId: string;
  startTime: number;
  isLive: boolean;
  livepeerPlaybackId?: string;
  lastUpdate: number;
}

type StreamDataMap = Record<string, StreamTrackingData>;
type DaaMap = Record<string, number>;

// Stream data tracking functions
function readStreamData(): StreamDataMap {
  try {
    return JSON.parse(localStorage.getItem(STREAM_DATA_KEY) || "{}") as StreamDataMap;
  } catch {
    return {};
  }
}

function writeStreamData(data: StreamDataMap) {
  localStorage.setItem(STREAM_DATA_KEY, JSON.stringify(data));
}

export function startStreamTracking(streamId: string, livepeerPlaybackId?: string) {
  const data = readStreamData();
  data[streamId] = {
    streamId,
    startTime: Date.now(),
    isLive: true,
    livepeerPlaybackId,
    lastUpdate: Date.now()
  };
  writeStreamData(data);
}

export function updateStreamStatus(streamId: string, isLive: boolean) {
  const data = readStreamData();
  if (data[streamId]) {
    data[streamId].isLive = isLive;
    data[streamId].lastUpdate = Date.now();
    writeStreamData(data);
  }
}

export function getStreamClipData(streamId: string, durationSeconds: number) {
  const data = readStreamData();
  const streamData = data[streamId];
  
  if (!streamData) {
    return null;
  }
  
  const now = Date.now();
  const streamElapsed = (now - streamData.startTime) / 1000; // in seconds
  
  return {
    startSeconds: Math.max(0, streamElapsed - durationSeconds),
    endSeconds: streamElapsed,
    livepeerPlaybackId: streamData.livepeerPlaybackId,
    isLive: streamData.isLive
  };
}

export function stopStreamTracking(streamId: string) {
  const data = readStreamData();
  if (data[streamId]) {
    data[streamId].isLive = false;
    data[streamId].lastUpdate = Date.now();
    writeStreamData(data);
  }
}

export function clearStreamData(streamId: string) {
  const data = readStreamData();
  delete data[streamId];
  writeStreamData(data);
}

// Legacy DAA functions (keep for compatibility)
function readDaaMap(): DaaMap {
  try {
    return JSON.parse(localStorage.getItem(STREAM_START_DAA_KEY) || "{}") as DaaMap;
  } catch {
    return {};
  }
}

function writeDaaMap(m: DaaMap) {
  localStorage.setItem(STREAM_START_DAA_KEY, JSON.stringify(m));
}

export function getStartDaa(address: string): number | null {
  const m = readDaaMap();
  const v = m[address];
  return typeof v === 'number' ? v : null;
}

export function setStartDaa(address: string, daa: number) {
  const m = readDaaMap();
  m[address] = Math.max(0, Math.floor(daa));
  writeDaaMap(m);
}

export function clearStartDaa(address: string) {
  const m = readDaaMap();
  delete m[address];
  writeDaaMap(m);
}

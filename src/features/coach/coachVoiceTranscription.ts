/**
 * Certified coach voice → Whisper transcription corridor.
 *
 * Single production implementation. Call sites must reuse this module
 * rather than introducing a second recorder/transcription pipeline.
 *
 * Phase A: requests verbose_json so segment timestamps can seed a
 * coach-local TimedTranscript. coachNote still consumes plain `text` only.
 */
import { File } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import { fetch as expoFetch } from "expo/fetch";

import type { TimedTranscriptSegment } from "../../types/timedTranscript";

export const TRANSCRIBE_RUNTIME_LOG_TAG = "[TRANSCRIBE_RUNTIME_TRACE]";
export const TRANSCRIBE_UPLOAD_FILENAME = "recording.m4a";
export const TRANSCRIBE_UPLOAD_MIME_TYPE = "audio/mp4";

export type CoachVoiceTranscriptionResult = {
  text: string;
  segments: TimedTranscriptSegment[];
};

type WhisperVerboseSegment = {
  id?: unknown;
  start?: unknown;
  end?: unknown;
  text?: unknown;
};

type WhisperVerboseJson = {
  text?: string;
  segments?: WhisperVerboseSegment[];
  error?: { message?: string; type?: string; code?: string };
};

/** Parse Whisper verbose_json segments into TimedTranscriptSegment[]. */
export function parseWhisperVerboseSegments(
  rawSegments: WhisperVerboseSegment[] | undefined,
): TimedTranscriptSegment[] {
  if (!Array.isArray(rawSegments)) return [];

  const segments: TimedTranscriptSegment[] = [];
  for (let index = 0; index < rawSegments.length; index += 1) {
    const row = rawSegments[index];
    if (!row || typeof row !== "object") continue;

    const text = typeof row.text === "string" ? row.text.trim() : "";
    const startSec = typeof row.start === "number" && Number.isFinite(row.start) ? row.start : null;
    const endSec = typeof row.end === "number" && Number.isFinite(row.end) ? row.end : null;
    if (!text || startSec === null || endSec === null) continue;

    const startMs = Math.round(startSec * 1000);
    const endMs = Math.round(endSec * 1000);
    if (startMs < 0 || endMs < startMs) continue;

    const whisperId =
      typeof row.id === "number" && Number.isFinite(row.id) ? String(row.id) : String(index);
    segments.push({
      id: `seg-${whisperId}`,
      startMs,
      endMs,
      text,
    });
  }
  return segments;
}

export function uriScheme(uri: string): string {
  const idx = uri.indexOf("://");
  return idx >= 0 ? uri.slice(0, idx + 3) : "no-scheme";
}

export function transcribeRuntimeErrorFields(error: unknown): {
  errorMessage: string;
  errorName: string;
  errorCode?: unknown;
  errorStack?: string;
} {
  if (error instanceof Error) {
    const codedError = error as Error & { code?: unknown };
    return {
      errorMessage: error.message,
      errorName: error.name,
      ...(typeof codedError.code !== "undefined" ? { errorCode: codedError.code } : {}),
      ...(typeof error.stack === "string" ? { errorStack: error.stack } : {}),
    };
  }
  return { errorMessage: String(error), errorName: "unknown" };
}

export function logTranscribeRuntime(stage: string, payload: Record<string, unknown> = {}): void {
  console.log(TRANSCRIBE_RUNTIME_LOG_TAG, { stage, ...payload });
}

export async function describeAudioFileForUpload(uri: string): Promise<Record<string, unknown>> {
  const base = {
    uri,
    filename: TRANSCRIBE_UPLOAD_FILENAME,
    mimeType: TRANSCRIBE_UPLOAD_MIME_TYPE,
    uriScheme: uriScheme(uri),
  };
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return {
      ...base,
      fileExists: info.exists,
      fileSize: info.exists ? info.size : null,
    };
  } catch (error) {
    return {
      ...base,
      fileExists: null,
      fileSize: null,
      fileInfoError: transcribeRuntimeErrorFields(error).errorMessage,
    };
  }
}

/** Whisper multipart upload — production-certified transport. */
export async function transcribeCoachAudio(uri: string): Promise<CoachVoiceTranscriptionResult> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  logTranscribeRuntime("api_key_check", { hasApiKey: Boolean(apiKey) });
  if (!apiKey) {
    logTranscribeRuntime("missing_api_key", { stage: "transcribeAudio" });
    throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY");
  }

  const filename = TRANSCRIBE_UPLOAD_FILENAME;
  const mimeType = TRANSCRIBE_UPLOAD_MIME_TYPE;
  const fileMeta = await describeAudioFileForUpload(uri);
  logTranscribeRuntime("uri_metadata", { stage: "pre_upload", ...fileMeta });
  const normalizedUri = uri.startsWith("file://") ? uri : `file://${uri}`;
  const fileInfo = await FileSystem.getInfoAsync(uri);
  const fileSize = fileInfo.exists ? fileInfo.size : null;
  console.log(
    "[TRANSCRIBE_RUNTIME_TRACE]",
    JSON.stringify({
      stage: "upload_payload",
      uri,
      normalizedUri,
      exists: fileInfo.exists,
      size: fileSize,
      modificationTime: fileInfo.exists ? fileInfo.modificationTime : null,
    }),
  );
  if (!fileInfo.exists || typeof fileSize !== "number" || fileSize <= 0) {
    console.log(
      "[TRANSCRIBE_RUNTIME_TRACE]",
      JSON.stringify({
        stage: "invalid_audio_file",
        uri,
        normalizedUri,
        exists: fileInfo.exists,
        size: fileSize,
      }),
    );
    throw new Error("Invalid audio file for transcription");
  }

  const audioFile = new File(normalizedUri);
  const formData = new FormData();
  formData.append("file", audioFile, filename);
  console.log(
    "[TRANSCRIBE_RUNTIME_TRACE]",
    JSON.stringify({
      stage: "formdata_append_complete",
      mimeType,
      filename,
    }),
  );
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");

  logTranscribeRuntime("fetch_start", {
    stage: "openai_request",
    url: "https://api.openai.com/v1/audio/transcriptions",
    model: "whisper-1",
    response_format: "verbose_json",
  });
  logTranscribeRuntime("expo_file_upload_start", {
    stage: "expo_file_upload_start",
    filename,
    mimeType,
    fileSize,
  });

  let res: Response;
  try {
    res = await expoFetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });
  } catch (error) {
    const fetchError = error as { name?: unknown; message?: unknown; code?: unknown; stack?: unknown };
    console.log(
      "[TRANSCRIBE_RUNTIME_TRACE]",
      JSON.stringify({
        stage: "upload_fetch_failure",
        name: fetchError?.name,
        message: fetchError?.message,
        code: fetchError?.code,
        stack:
          typeof fetchError?.stack === "string" ? fetchError.stack.slice(0, 1200) : null,
      }),
    );
    logTranscribeRuntime("fetch_threw", {
      stage: "openai_request",
      ...transcribeRuntimeErrorFields(error),
    });
    throw error;
  }

  logTranscribeRuntime("fetch_response", {
    stage: "openai_request",
    status: res.status,
    ok: res.ok,
    statusText: res.statusText,
  });
  logTranscribeRuntime("expo_file_upload_response", {
    stage: "expo_file_upload_response",
    status: res.status,
    ok: res.ok,
    statusText: res.statusText,
  });

  let rawBody = "";
  try {
    rawBody = await res.text();
  } catch (error) {
    logTranscribeRuntime("response_body_read_failed", {
      stage: "parse_response",
      status: res.status,
      ...transcribeRuntimeErrorFields(error),
    });
    throw error;
  }

  let json: WhisperVerboseJson;
  try {
    json = JSON.parse(rawBody) as WhisperVerboseJson;
  } catch (error) {
    logTranscribeRuntime("response_json_parse_failed", {
      stage: "parse_response",
      status: res.status,
      rawBodyPreview: rawBody.slice(0, 500),
      ...transcribeRuntimeErrorFields(error),
    });
    throw error;
  }

  logTranscribeRuntime("response_body", {
    stage: "parse_response",
    status: res.status,
    body: json,
  });

  if (!res.ok) {
    const message = json?.error?.message ?? "Transcription request failed";
    logTranscribeRuntime("openai_error", {
      stage: "openai_request",
      status: res.status,
      error: json?.error ?? null,
      errorMessage: message,
    });
    throw new Error(message);
  }

  const text = typeof json.text === "string" ? json.text.trim() : "";
  if (!text) {
    logTranscribeRuntime("empty_transcription_text", {
      stage: "parse_response",
      status: res.status,
      body: json,
    });
    throw new Error("No transcription text returned");
  }

  const segments = parseWhisperVerboseSegments(json.segments);
  logTranscribeRuntime("transcription_success", {
    stage: "transcribeAudio",
    textLength: text.length,
    segmentCount: segments.length,
  });
  return { text, segments };
}

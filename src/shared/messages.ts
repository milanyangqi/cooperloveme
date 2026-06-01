import type { RuntimeRequest, RuntimeResponse, RuntimeRequestType } from "./types";

export function sendRuntimeMessage<T>(message: RuntimeRequest): Promise<RuntimeResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: RuntimeResponse<T> | undefined) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message ?? "Runtime message failed" });
        return;
      }

      resolve(response ?? { ok: false, error: "No response from extension background" });
    });
  });
}

export function hasPayload<T extends RuntimeRequestType>(
  message: RuntimeRequest,
  type: T
): message is Extract<RuntimeRequest, { type: T }> {
  return message.type === type;
}

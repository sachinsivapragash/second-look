// Decides where a check runs. The Firebase AI Logic SDK's PREFER_ON_DEVICE mode falls back to the
// cloud with the SAME prompt, which would send personal data along. Second Look decides itself:
//   - on-device model ready            -> ONLY_ON_DEVICE with the original text (never leaves the device)
//   - "private only" switched on        -> ONLY_ON_DEVICE, or the offline checks alone if no model
//   - otherwise (no model / too long)   -> ONLY_IN_CLOUD with personal data removed first
export const MODES = { ON: 'only_on_device', CLOUD: 'only_in_cloud' };

export function route({ availability, length, privateOnly, maxOnDeviceChars }) {
  const ready = availability === 'available';
  if (privateOnly) return ready ? { mode: MODES.ON, redact: false, why: 'private' } : { mode: null, redact: false, why: 'private-no-model' };
  if (ready && length <= maxOnDeviceChars) return { mode: MODES.ON, redact: false, why: 'on-device' };
  return { mode: MODES.CLOUD, redact: true, why: ready ? 'too-long' : availability === 'downloadable' || availability === 'downloading' ? 'model-downloading' : 'no-model' };
}

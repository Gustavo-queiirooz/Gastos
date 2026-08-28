// WebAuthn browser helpers (base64url <-> ArrayBuffer + credential serialization)
export function b64uToBuf(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

export function bufToB64u(buf) {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function serializeCredential(cred) {
  const r = cred.response;
  const out = {
    id: cred.id,
    rawId: bufToB64u(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
    response: {},
  };
  if (r.attestationObject) {
    out.response.clientDataJSON = bufToB64u(r.clientDataJSON);
    out.response.attestationObject = bufToB64u(r.attestationObject);
  } else {
    out.response.clientDataJSON = bufToB64u(r.clientDataJSON);
    out.response.authenticatorData = bufToB64u(r.authenticatorData);
    out.response.signature = bufToB64u(r.signature);
    out.response.userHandle = r.userHandle ? bufToB64u(r.userHandle) : null;
  }
  return out;
}

export function prepareCreationOptions(opts) {
  opts.challenge = b64uToBuf(opts.challenge);
  opts.user.id = b64uToBuf(opts.user.id);
  if (opts.excludeCredentials) opts.excludeCredentials = opts.excludeCredentials.map((c) => ({ ...c, id: b64uToBuf(c.id) }));
  return opts;
}

export function prepareRequestOptions(opts) {
  opts.challenge = b64uToBuf(opts.challenge);
  if (opts.allowCredentials) opts.allowCredentials = opts.allowCredentials.map((c) => ({ ...c, id: b64uToBuf(c.id) }));
  return opts;
}

export const webauthnAvailable = () => typeof window !== "undefined" && !!window.PublicKeyCredential;

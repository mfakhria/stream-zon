function normalizeIceServerEntry(
  entry: RTCIceServer,
  turnUsername?: string,
  turnPassword?: string,
): RTCIceServer {
  const urls = Array.isArray(entry.urls) ? entry.urls : [entry.urls];
  const containsTurn = urls.some((url) => url.startsWith("turn:"));

  if (!containsTurn) {
    return entry;
  }

  return {
    ...entry,
    username: entry.username ?? turnUsername,
    credential: entry.credential ?? turnPassword,
  };
}

export function buildIceServersFromEnv(): RTCIceServer[] {
  const turnUsername = process.env.TURN_USERNAME;
  const turnPassword = process.env.TURN_PASSWORD;
  const configuredServers = process.env.ICE_SERVERS_JSON;

  if (configuredServers) {
    try {
      const parsed = JSON.parse(configuredServers) as RTCIceServer[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((entry) =>
          normalizeIceServerEntry(entry, turnUsername, turnPassword),
        );
      }
    } catch (error) {
      console.warn("Failed to parse ICE_SERVERS_JSON, falling back to public STUN.", error);
    }
  }

  return [
    {
      urls: ["stun:stun.l.google.com:19302"],
    },
  ];
}

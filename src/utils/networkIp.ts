/**
 * Utility to detect the real IP address of the device using:
 * 1. Current window.location.hostname if IPv4
 * 2. WebRTC ICE candidate local adapter discovery (typ host / typ srflx)
 * 3. Server-side /api/network/ip detection
 * 4. External public IP fallback
 */

export interface DetectedIpCandidate {
  ip: string;
  label: string;
  type: 'lan' | 'public' | 'host';
  isRecommended?: boolean;
}

export interface DeviceIpDetectionResult {
  primaryIp: string;
  candidates: DetectedIpCandidate[];
  source: string;
}

function isValidIpv4(ip: string): boolean {
  if (!ip) return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every(part => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255 && part === String(num);
  });
}

function isLanIp(ip: string): boolean {
  if (!isValidIpv4(ip)) return false;
  if (ip.startsWith('169.254.')) return false; // Ignore link-local APIPA addresses
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('10.')) return true;
  const parts = ip.split('.').map(Number);
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (ip.startsWith('100.')) return true; // CGNAT / Mobile Hotspot
  return false;
}

/**
 * Discovers IP via WebRTC ICE candidates directly in the browser.
 */
async function getWebRtcIps(timeoutMs = 2000): Promise<{ lanIps: string[]; publicIps: string[] }> {
  const lanIps = new Set<string>();
  const publicIps = new Set<string>();

  return new Promise(resolve => {
    const RTCPC = window.RTCPeerConnection || (window as any).webkitRTCPeerConnection;
    if (!RTCPC) {
      return resolve({ lanIps: [], publicIps: [] });
    }

    let pc: RTCPeerConnection | null = null;
    let timer: any = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (pc) {
        try {
          pc.close();
        } catch (e) {}
        pc = null;
      }
      resolve({
        lanIps: Array.from(lanIps),
        publicIps: Array.from(publicIps)
      });
    };

    try {
      pc = new RTCPC({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      pc.createDataChannel('serchtube-ip-probe');

      pc.onicecandidate = (event) => {
        if (!event || !event.candidate || !event.candidate.candidate) {
          // Finished candidates
          return;
        }

        const cand = event.candidate.candidate;
        // Search for IPv4 pattern
        const match = cand.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3})/);
        if (match && match[1]) {
          const ip = match[1];
          if (isValidIpv4(ip) && !ip.startsWith('127.') && !ip.startsWith('0.') && ip !== '255.255.255.255') {
            if (cand.includes('typ host') || isLanIp(ip)) {
              lanIps.add(ip);
            } else if (cand.includes('typ srflx') || !isLanIp(ip)) {
              publicIps.add(ip);
            } else {
              lanIps.add(ip);
            }
          }
        }
      };

      pc.createOffer()
        .then(offer => {
          if (pc) pc.setLocalDescription(offer).catch(() => {});
        })
        .catch(() => {});

      timer = setTimeout(cleanup, timeoutMs);
    } catch (e) {
      cleanup();
    }
  });
}

/**
 * Fetch server-side network IP detection
 */
async function getServerIps(): Promise<{ localIps: string[]; primaryLan?: string; clientIp?: string } | null> {
  try {
    const res = await fetch('/api/network/ip', { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      return {
        localIps: (data.localIps || []).map((item: any) => item.ip).filter(isValidIpv4),
        primaryLan: data.primaryLan && isValidIpv4(data.primaryLan) ? data.primaryLan : undefined,
        clientIp: data.clientIp && isValidIpv4(data.clientIp) ? data.clientIp : undefined
      };
    }
  } catch (e) {
    // ignore
  }
  return null;
}

/**
 * Public IP lookup fallback
 */
async function getPublicIpFallback(): Promise<string | null> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const json = await res.json();
      if (json?.ip && isValidIpv4(json.ip)) {
        return json.ip;
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Main function: detects real device IP and returns candidates
 */
export async function detectRealDeviceIp(): Promise<DeviceIpDetectionResult> {
  const candidatesMap = new Map<string, DetectedIpCandidate>();

  // 1. Check current hostname if it is a real IPv4 address
  const host = window.location.hostname;
  if (isValidIpv4(host) && !host.startsWith('127.') && host !== '0.0.0.0') {
    const isLan = isLanIp(host);
    candidatesMap.set(host, {
      ip: host,
      label: isLan ? 'IP URL Navegador (LAN)' : 'IP URL Navegador',
      type: isLan ? 'lan' : 'host',
      isRecommended: true
    });
  }

  // 2. Concurrently run WebRTC discovery and Server IP query
  const [webrtcResult, serverResult] = await Promise.all([
    getWebRtcIps(1800),
    getServerIps()
  ]);

  // Add WebRTC LAN IPs
  for (const ip of webrtcResult.lanIps) {
    if (!candidatesMap.has(ip)) {
      candidatesMap.set(ip, {
        ip,
        label: 'WiFi / Red Local (WebRTC)',
        type: 'lan',
        isRecommended: true
      });
    }
  }

  // Add Server LAN IPs (from os.networkInterfaces)
  if (serverResult?.localIps) {
    for (const ip of serverResult.localIps) {
      if (!candidatesMap.has(ip)) {
        const isLan = isLanIp(ip);
        candidatesMap.set(ip, {
          ip,
          label: isLan ? 'Interfaz de Red (Servidor)' : 'IP Servidor',
          type: isLan ? 'lan' : 'host',
          isRecommended: isLan && !Array.from(candidatesMap.values()).some(c => c.isRecommended)
        });
      }
    }
  }

  // Add WebRTC public / reflexive IPs
  for (const ip of webrtcResult.publicIps) {
    if (!candidatesMap.has(ip)) {
      candidatesMap.set(ip, {
        ip,
        label: 'IP Pública / Reflexiva',
        type: 'public'
      });
    }
  }

  // Add Client IP reported by server
  if (serverResult?.clientIp && !candidatesMap.has(serverResult.clientIp)) {
    const isLan = isLanIp(serverResult.clientIp);
    candidatesMap.set(serverResult.clientIp, {
      ip: serverResult.clientIp,
      label: isLan ? 'IP Cliente Detectada' : 'IP Pública de Conexión',
      type: isLan ? 'lan' : 'public'
    });
  }

  // If still no candidates found, fallback to public IP lookup
  if (candidatesMap.size === 0) {
    const publicIp = await getPublicIpFallback();
    if (publicIp) {
      candidatesMap.set(publicIp, {
        ip: publicIp,
        label: 'IP Pública (ipify)',
        type: 'public'
      });
    }
  }

  const allCandidates = Array.from(candidatesMap.values());

  // Determine the best primary IP:
  // Priority:
  // 1. Current URL hostname if IPv4
  // 2. WebRTC LAN IP (192.168.x.x, 10.x.x.x, 172.x.x.x)
  // 3. Server LAN IP
  // 4. Server client IP
  // 5. Public IP
  // 6. Default fallback
  let primaryIp = '192.168.1.100';
  let source = 'Default';

  const currentHostIp = isValidIpv4(host) && !host.startsWith('127.') ? host : null;
  const lanCandidate = allCandidates.find(c => c.type === 'lan' || isLanIp(c.ip));
  const anyCandidate = allCandidates[0];

  if (currentHostIp) {
    primaryIp = currentHostIp;
    source = 'URL del navegador';
  } else if (lanCandidate) {
    primaryIp = lanCandidate.ip;
    source = lanCandidate.label;
  } else if (anyCandidate) {
    primaryIp = anyCandidate.ip;
    source = anyCandidate.label;
  }

  return {
    primaryIp,
    candidates: allCandidates,
    source
  };
}

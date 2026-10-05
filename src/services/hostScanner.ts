/**
 * SerchTube Host Subnet & Port Scanner
 * 
 * Automatically detects changes in Host IP address (e.g. following power outage,
 * router reboot, or DHCP reallocation) and connects Satellite remotes without
 * requiring the user to re-scan the QR code.
 */

export interface DiscoveredHost {
  ip: string;
  port: number;
  url: string;
  latencyMs: number;
  app: string;
  role: string;
  timestamp: number;
}

export interface ScanProgress {
  scanned: number;
  total: number;
  percent: number;
  currentIp: string;
  currentSubnet: string;
}

export const COMMON_LOCAL_SUBNETS = [
  '192.168.1.',  // Standard home/car routers
  '192.168.0.',  // Common router subnet
  '192.168.43.', // Android Mobile Hotspot default
  '172.20.10.',  // iOS Personal Hotspot default
  '192.168.2.',  // Secondary routers
  '10.0.0.'      // Enterprise / Xfinity / custom
];

export class HostScannerService {
  private static instance: HostScannerService | null = null;
  private isScanning = false;
  private abortController: AbortController | null = null;

  public static getInstance(): HostScannerService {
    if (!HostScannerService.instance) {
      HostScannerService.instance = new HostScannerService();
    }
    return HostScannerService.instance;
  }

  /**
   * Determine primary candidate subnet based on current location and history
   */
  public getDetectedSubnetPrefix(): string {
    // 1. Check window.location.hostname if it is an IPv4
    const currentHost = window.location.hostname;
    const ipMatch = currentHost.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)\d{1,3}$/);
    if (ipMatch) {
      return ipMatch[1];
    }

    // 2. Check localStorage saved host IP
    try {
      const saved = localStorage.getItem('serchtube_last_known_host_ip');
      if (saved) {
        const savedMatch = saved.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.)\d{1,3}/);
        if (savedMatch) return savedMatch[1];
      }
    } catch (_) {}

    return '192.168.1.';
  }

  /**
   * Get target port (defaults to current window port or 3000)
   */
  public getTargetPort(): number {
    const port = parseInt(window.location.port, 10);
    return isNaN(port) || port <= 0 ? 3000 : port;
  }

  /**
   * Fast probe against a single candidate IP on target port
   */
  public async probeCandidate(ip: string, port = 3000, timeoutMs = 1200): Promise<DiscoveredHost | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = performance.now();

    try {
      const targetUrl = `http://${ip}:${port}`;
      const response = await fetch(`${targetUrl}/api/serchtube/discovery`, {
        method: 'GET',
        signal: controller.signal,
        mode: 'cors',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.app === 'SerchTube Music' || data.appName === 'SerchTube Music') {
          return {
            ip,
            port,
            url: targetUrl,
            latencyMs: Math.round(performance.now() - startTime),
            app: data.appName || data.app,
            role: data.role || 'master',
            timestamp: Date.now()
          };
        }
      }
    } catch (_) {
      // Fallback: check /api/health
      try {
        const fallbackCtrl = new AbortController();
        const fbTimeout = setTimeout(() => fallbackCtrl.abort(), 600);
        const fbRes = await fetch(`http://${ip}:${port}/api/health`, {
          method: 'GET',
          signal: fallbackCtrl.signal,
          mode: 'cors',
          cache: 'no-store'
        });
        clearTimeout(fbTimeout);
        if (fbRes.ok) {
          const data = await fbRes.json();
          if (data.status === 'ok' && (data.appName?.includes('SerchTube') || data.app?.includes('SerchTube'))) {
            return {
              ip,
              port,
              url: `http://${ip}:${port}`,
              latencyMs: Math.round(performance.now() - startTime),
              app: data.appName || 'SerchTube Music',
              role: 'master',
              timestamp: Date.now()
            };
          }
        }
      } catch (__) {}
    } finally {
      clearTimeout(timeoutId);
    }

    return null;
  }

  /**
   * Cancel any in-progress scan
   */
  public cancelScan() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isScanning = false;
  }

  /**
   * Scan a specific subnet prefix (e.g. "192.168.1.") across .1 to .254
   */
  public async scanSubnet(
    subnetPrefix: string,
    options?: {
      port?: number;
      timeoutPerHostMs?: number;
      concurrency?: number;
      onProgress?: (progress: ScanProgress) => void;
      onFound?: (host: DiscoveredHost) => void;
    }
  ): Promise<DiscoveredHost | null> {
    this.cancelScan();
    this.isScanning = true;
    this.abortController = new AbortController();

    const port = options?.port || this.getTargetPort();
    const timeoutMs = options?.timeoutPerHostMs || 1200;
    const concurrency = options?.concurrency || 20;

    // Prioritized IP list: start around typical DHCP range (e.g. .50 - .200, then .2 - .49, then .201 - .254)
    const ips: string[] = [];
    
    // First, check the IP stored in localStorage if on same subnet
    try {
      const lastKnown = localStorage.getItem('serchtube_last_known_host_ip');
      if (lastKnown) {
        const match = lastKnown.match(/https?:\/\/([^:/]+)/);
        if (match && match[1].startsWith(subnetPrefix)) {
          ips.push(match[1]);
        }
      }
    } catch (_) {}

    // Add standard DHCP ranges first
    for (let i = 2; i <= 254; i++) {
      const candidate = `${subnetPrefix}${i}`;
      if (!ips.includes(candidate)) {
        ips.push(candidate);
      }
    }

    const total = ips.length;
    let scanned = 0;

    // Process in parallel chunks
    for (let i = 0; i < ips.length; i += concurrency) {
      if (!this.isScanning || this.abortController?.signal.aborted) {
        break;
      }

      const chunk = ips.slice(i, i + concurrency);
      const promises = chunk.map(async (candidateIp) => {
        if (!this.isScanning || this.abortController?.signal.aborted) return null;

        const result = await this.probeCandidate(candidateIp, port, timeoutMs);
        scanned++;

        options?.onProgress?.({
          scanned,
          total,
          percent: Math.min(100, Math.round((scanned / total) * 100)),
          currentIp: candidateIp,
          currentSubnet: subnetPrefix
        });

        return result;
      });

      const results = await Promise.all(promises);
      const found = results.find((r): r is DiscoveredHost => r !== null);

      if (found) {
        this.isScanning = false;
        this.saveDiscoveredHost(found.url);
        options?.onFound?.(found);
        return found;
      }
    }

    this.isScanning = false;
    return null;
  }

  /**
   * Multi-subnet search: scans primary subnet first, then secondary common subnets
   */
  public async autoDiscoverHost(options?: {
    port?: number;
    onProgress?: (progress: ScanProgress) => void;
    onFound?: (host: DiscoveredHost) => void;
  }): Promise<DiscoveredHost | null> {
    const primarySubnet = this.getDetectedSubnetPrefix();
    
    // 1. Scan primary subnet
    const foundPrimary = await this.scanSubnet(primarySubnet, options);
    if (foundPrimary) return foundPrimary;

    // 2. Scan secondary subnets if not found
    const secondarySubnets = COMMON_LOCAL_SUBNETS.filter(s => s !== primarySubnet);
    for (const sub of secondarySubnets) {
      if (this.abortController?.signal.aborted) break;
      const foundSec = await this.scanSubnet(sub, options);
      if (foundSec) return foundSec;
    }

    return null;
  }

  public saveDiscoveredHost(url: string) {
    try {
      localStorage.setItem('serchtube_last_known_host_ip', url);
      // Clean host:port
      const cleanHost = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      localStorage.setItem('serchtube_custom_ws_host', cleanHost);
    } catch (_) {}
  }

  public getLastKnownHost(): string | null {
    try {
      return localStorage.getItem('serchtube_last_known_host_ip') || null;
    } catch (_) {
      return null;
    }
  }

  public isScanActive(): boolean {
    return this.isScanning;
  }
}

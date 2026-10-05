import { NodeRole, PlayerState, SyncMessage, Track } from '../types';

export interface NodeSyncConfig {
  role: NodeRole;
  nodeId: string;
  nodeName: string;
  room: string;
}

export class NodeSyncService {
  private static instance: NodeSyncService | null = null;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectTimeout: any = null;
  private pingInterval: any = null;

  private config: NodeSyncConfig = {
    role: 'master',
    nodeId: 'node-' + Math.random().toString(36).substring(2, 8),
    nodeName: 'Dispositivo Principal',
    room: 'serchtube-master'
  };

  private onStateUpdateCallback?: (state: Partial<PlayerState>) => void;
  private onPlaylistQueueCallback?: (queue: Track[]) => void;
  private onCommandReceivedCallback?: (command: any, fromNode: string) => void;
  private onDirectEventCallback?: (eventPayload: any) => void;
  private onSatelliteMicEventCallback?: (data: { nodeId: string; isListening: boolean }) => void;
  private onConnectionChangeCallback?: (connected: boolean, connectedCount: number) => void;
  private onNodeJoinedCallback?: () => void;
  private connectedNodesCount = 1;
  private customHost: string | null = null;

  private constructor() {
    // Load persisted settings
    try {
      const savedRole = localStorage.getItem('serchtube_role') as NodeRole;
      const savedRoom = localStorage.getItem('serchtube_room');
      const savedName = localStorage.getItem('serchtube_nodename');
      const savedHost = localStorage.getItem('serchtube_custom_ws_host');
      if (savedRole) this.config.role = savedRole;
      if (savedRoom) this.config.room = savedRoom;
      if (savedName) this.config.nodeName = savedName;
      if (savedHost) this.customHost = savedHost;
    } catch (e) {
      // ignore
    }
  }

  public setCustomHost(host: string) {
    const clean = host.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    this.customHost = clean;
    try {
      localStorage.setItem('serchtube_custom_ws_host', clean);
    } catch (_) {}
    this.reconnect();
  }

  public getActiveHost(): string {
    return this.customHost || window.location.host;
  }

  public reconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this.isConnected = false;
    this.connect();
  }

  public static getInstance(): NodeSyncService {
    if (!NodeSyncService.instance) {
      NodeSyncService.instance = new NodeSyncService();
    }
    return NodeSyncService.instance;
  }

  public getConfig(): NodeSyncConfig {
    return { ...this.config };
  }

  public setRole(role: NodeRole, nodeName?: string, room?: string) {
    this.config.role = role;
    if (nodeName) this.config.nodeName = nodeName;
    if (room) this.config.room = room;

    try {
      localStorage.setItem('serchtube_role', role);
      if (room) localStorage.setItem('serchtube_room', room);
      if (nodeName) localStorage.setItem('serchtube_nodename', nodeName);
    } catch (e) {}

    // Re-register with the WebSocket server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: role === 'master' ? 'register_master' : 'register_satellite',
        nodeId: this.config.nodeId,
        nodeName: this.config.nodeName,
        role: this.config.role,
        room: this.config.room
      }));
    } else {
      this.connect();
    }
  }

  public setCallbacks(callbacks: {
    onStateUpdate?: (state: Partial<PlayerState>) => void;
    onPlaylistQueue?: (queue: Track[]) => void;
    onCommandReceived?: (command: any, fromNode: string) => void;
    onDirectEvent?: (eventPayload: any) => void;
    onSatelliteMicEvent?: (data: { nodeId: string; isListening: boolean }) => void;
    onConnectionChange?: (connected: boolean, count: number) => void;
    onNodeJoined?: () => void;
  }) {
    this.onStateUpdateCallback = callbacks.onStateUpdate;
    this.onPlaylistQueueCallback = callbacks.onPlaylistQueue;
    this.onCommandReceivedCallback = callbacks.onCommandReceived;
    this.onDirectEventCallback = callbacks.onDirectEvent;
    this.onSatelliteMicEventCallback = callbacks.onSatelliteMicEvent;
    this.onConnectionChangeCallback = callbacks.onConnectionChange;
    this.onNodeJoinedCallback = callbacks.onNodeJoined;
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const activeHost = this.getActiveHost();
      // Use ws: for local LAN IPs (192.168.x.x, 10.x.x.x, localhost, etc.)
      const isSecure = window.location.protocol === 'https:' && !activeHost.startsWith('192.') && !activeHost.startsWith('10.') && !activeHost.startsWith('172.') && !activeHost.includes('localhost');
      const protocol = isSecure ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${activeHost}/ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.onConnectionChangeCallback?.(true, this.connectedNodesCount);

        // Register role and room
        this.ws?.send(JSON.stringify({
          type: this.config.role === 'master' ? 'register_master' : 'register_satellite',
          nodeId: this.config.nodeId,
          nodeName: this.config.nodeName,
          role: this.config.role,
          room: this.config.room
        }));

        // Heartbeat ping every 10s
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 10000);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Direct player events from Command Dispatcher (LOAD_VIDEO, PAUSE, RESUME, SET_VOLUME, etc.)
          if (msg.event) {
            this.onDirectEventCallback?.(msg);
            return;
          }

          if (msg.type === 'playback_state') {
            // Satellite nodes receive Android/Master playback state
            if (this.config.role === 'satellite') {
              let vol = typeof msg.volume === 'number' ? msg.volume : 10;
              if (vol > 15) {
                vol = Math.round((vol / 100) * 15);
              }
              const adaptedState: Partial<PlayerState> = {
                isPlaying: msg.isPlaying,
                volume: Math.min(15, Math.max(0, vol)),
                isMuted: msg.isMuted,
                currentTime: msg.currentTrack?.position ?? 0
              };
              if (msg.currentTrack) {
                const trackId = msg.currentTrack.id || msg.currentTrack.videoId || 'track';
                const trackThumb = msg.currentTrack.thumbnail || msg.currentTrack.miniatura || (trackId ? `https://i.ytimg.com/vi/${trackId}/hqdefault.jpg` : '');
                adaptedState.currentTrack = {
                  id: trackId,
                  title: msg.currentTrack.title || msg.currentTrack.name || 'Canción',
                  artist: msg.currentTrack.artist || 'Artista',
                  thumbnail: trackThumb,
                  duration: typeof msg.currentTrack.duration === 'number'
                    ? `${Math.floor(msg.currentTrack.duration / 60)}:${(msg.currentTrack.duration % 60).toString().padStart(2, '0')}`
                    : (msg.currentTrack.duration || '3:30')
                };
              }
              const rawQueue = msg.queue || msg.playlist || msg.upcomingQueue;
              if (Array.isArray(rawQueue) && rawQueue.length > 0) {
                const parsedQueue: Track[] = rawQueue.map((item: any) => {
                  const id = item.id || item.videoId || '';
                  const thumb = item.thumbnail || item.miniatura || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');
                  return {
                    id,
                    title: item.title || item.name || 'Canción',
                    artist: item.artist || 'Artista',
                    thumbnail: thumb,
                    duration: typeof item.duration === 'number'
                      ? `${Math.floor(item.duration / 60)}:${(item.duration % 60).toString().padStart(2, '0')}`
                      : (item.duration || '3:30')
                  };
                });
                adaptedState.playlistQueue = parsedQueue;
                this.onPlaylistQueueCallback?.(parsedQueue);
              }
              this.onStateUpdateCallback?.(adaptedState);
            }
          } else if (msg.type === 'state_update') {
            if (this.config.role === 'satellite') {
              const payload = { ...(msg.payload || {}) };
              if (typeof payload.volume === 'number') {
                if (payload.volume > 15) {
                  payload.volume = Math.round((payload.volume / 100) * 15);
                }
                payload.volume = Math.min(15, Math.max(0, payload.volume));
              }
              const rawQueue = payload.playlistQueue || payload.queue;
              if (Array.isArray(rawQueue) && rawQueue.length > 0) {
                const parsedQueue: Track[] = rawQueue.map((item: any) => {
                  const id = item.id || item.videoId || '';
                  const thumb = item.thumbnail || item.miniatura || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');
                  return {
                    id,
                    title: item.title || item.name || 'Canción',
                    artist: item.artist || 'Artista',
                    thumbnail: thumb,
                    duration: item.duration || '3:30'
                  };
                });
                payload.playlistQueue = parsedQueue;
                this.onPlaylistQueueCallback?.(parsedQueue);
              }
              this.onStateUpdateCallback?.(payload);
            }
          } else if (msg.type === 'playlist_queue' || msg.type === 'queue_update') {
            if (this.config.role === 'satellite') {
              const rawQueue = msg.queue || msg.playlist || msg.items || msg.payload?.queue || msg.payload?.playlistQueue || [];
              if (Array.isArray(rawQueue) && rawQueue.length > 0) {
                const parsedQueue: Track[] = rawQueue.map((item: any) => {
                  const id = item.id || item.videoId || '';
                  const thumb = item.thumbnail || item.miniatura || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');
                  return {
                    id,
                    title: item.title || item.name || 'Canción',
                    artist: item.artist || 'Artista',
                    thumbnail: thumb,
                    duration: item.duration || '3:30'
                  };
                });
                this.onPlaylistQueueCallback?.(parsedQueue);
                this.onStateUpdateCallback?.({ playlistQueue: parsedQueue });
              }
            }
          } else if (msg.type === 'voice_command' || msg.type === 'command') {
            // Master node receives voice command from Android Satellite or Web Satellite
            if (this.config.role === 'master') {
              const rawCmd = msg.payload || msg;
              const normalizedCmd = {
                action: rawCmd.action || msg.action || '',
                query: rawCmd.query || msg.query || rawCmd.rawQuery || msg.rawQuery || rawCmd.artist || '',
                rawQuery: rawCmd.rawQuery || msg.rawQuery || rawCmd.query || msg.query || '',
                volume: rawCmd.volume ?? rawCmd.volumeValue ?? rawCmd.value ?? msg.volume ?? msg.volumeValue ?? msg.value,
                volumeValue: rawCmd.volumeValue ?? rawCmd.volume ?? rawCmd.value ?? msg.volumeValue ?? msg.volume ?? msg.value,
                presetName: rawCmd.presetName ?? msg.presetName,
                nodeId: rawCmd.nodeId || msg.nodeId,
                nodeName: rawCmd.nodeName || msg.nodeName || msg.forwardedFrom || 'Satélite Mic (Android)',
                speechFeedback: rawCmd.speechFeedback || undefined,
                ...rawCmd
              };
              this.onCommandReceivedCallback?.(normalizedCmd, msg.forwardedFrom || normalizedCmd.nodeName);
            }
          } else if (msg.type === 'command_ack') {
            // Feedback confirmation from master
          } else if (msg.type === 'ping') {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'pong' }));
            }
          } else if (msg.type === 'satellite_mic_event') {
            this.onSatelliteMicEventCallback?.(msg.payload);
          } else if (msg.type === 'registration_confirmed') {
            this.isConnected = true;
            if (typeof msg.connectedCount === 'number') {
              this.connectedNodesCount = Math.max(1, msg.connectedCount);
            }
            this.onConnectionChangeCallback?.(true, this.connectedNodesCount);
          } else if (msg.type === 'node_joined') {
            this.connectedNodesCount = typeof msg.totalCount === 'number' ? msg.totalCount : (this.connectedNodesCount + 1);
            this.onConnectionChangeCallback?.(this.isConnected, this.connectedNodesCount);
            if (this.config.role === 'master') {
              this.onNodeJoinedCallback?.();
            }
          } else if (msg.type === 'node_left') {
            this.connectedNodesCount = typeof msg.totalCount === 'number' ? msg.totalCount : Math.max(1, this.connectedNodesCount - 1);
            this.onConnectionChangeCallback?.(this.isConnected, this.connectedNodesCount);
          }
        } catch (err) {
          console.error("WS client parse error:", err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.onConnectionChangeCallback?.(false, 1);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        this.onConnectionChangeCallback?.(false, 1);
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  // Master sends playback state and the next 20 songs queue (including current track with thumbnail and title) to all satellites
  public broadcastMasterState(state: Partial<PlayerState>, upcomingQueue?: Track[]) {
    if (this.config.role !== 'master' || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const currentTrack = state.currentTrack || (upcomingQueue && upcomingQueue[0]) || null;
    let durationSec = 240;
    if (currentTrack?.duration) {
      const parts = currentTrack.duration.split(':');
      if (parts.length === 2) {
        durationSec = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      }
    }

    // Build the 20 tracks array: index 0 is currently playing track, followed by next upcoming tracks
    const rawList: Track[] = [];
    if (upcomingQueue && upcomingQueue.length > 0) {
      rawList.push(...upcomingQueue);
    } else if (currentTrack) {
      rawList.push(currentTrack);
    }

    // Ensure strictly up to 20 tracks
    const formattedQueue = rawList.slice(0, 20).map((t, idx) => {
      const id = t.id || '';
      const thumbnail = t.thumbnail && !t.thumbnail.includes('unsplash')
        ? t.thumbnail
        : (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');
      const title = t.title || 'Canción';
      return {
        id,
        videoId: id,
        title,
        name: title, // Explicit Spanish alias ("nombre del video")
        artist: t.artist || 'Artista',
        thumbnail,
        miniatura: thumbnail, // Explicit Spanish alias ("miniatura")
        duration: t.duration || '3:30',
        isCurrent: idx === 0,
        index: idx
      };
    });

    // 1. Send state_update for Web Satellites & multi-device dashboards
    this.ws.send(JSON.stringify({
      type: 'state_update',
      room: this.config.room,
      nodeId: this.config.nodeId,
      nodeName: this.config.nodeName,
      role: 'master',
      timestamp: Date.now(),
      payload: {
        ...state,
        playlistQueue: formattedQueue,
        queue: formattedQueue
      }
    }));

    // 2. Send playback_state strictly formatted for Android Satellite App
    const currentTrackThumbnail = currentTrack?.thumbnail && !currentTrack.thumbnail.includes('unsplash')
      ? currentTrack.thumbnail
      : (currentTrack?.id ? `https://i.ytimg.com/vi/${currentTrack.id}/hqdefault.jpg` : '');

    const currentTrackId = currentTrack?.id || '';

    const androidPlaybackPacket = {
      type: 'playback_state',
      room: this.config.room,
      isPlaying: state.isPlaying ?? false,
      currentTrack: currentTrack ? {
        id: currentTrackId,
        videoId: currentTrackId,
        title: currentTrack.title,
        name: currentTrack.title, // "nombre del video"
        artist: currentTrack.artist,
        duration: durationSec,
        position: Math.round(state.currentTime ?? 0),
        thumbnail: currentTrackThumbnail,
        miniatura: currentTrackThumbnail // "miniatura"
      } : null,
      volume: typeof state.volume === 'number' ? Math.round(state.volume) : 10,
      volumePercent: Math.round(((state.volume ?? 10) / 15) * 100),
      rawPercent: Math.round(((state.volume ?? 10) / 15) * 100),
      isMuted: state.isMuted ?? false,
      // 20 songs playlist including the current one with thumbnail and video title
      queue: formattedQueue,
      playlist: formattedQueue,
      upcomingQueue: formattedQueue,
      nextTracks: formattedQueue.slice(1),
      totalQueueTracks: formattedQueue.length
    };

    this.ws.send(JSON.stringify(androidPlaybackPacket));

    // 3. Dedicated playlist_queue broadcast message
    this.ws.send(JSON.stringify({
      type: 'playlist_queue',
      room: this.config.room,
      nodeId: this.config.nodeId,
      nodeName: this.config.nodeName,
      timestamp: Date.now(),
      currentTrack: formattedQueue[0] || null,
      queue: formattedQueue,
      playlist: formattedQueue,
      total: formattedQueue.length
    }));
  }

  // Master sends confirmation / ACK to Satellite when a command is executed
  public sendCommandAck(nodeId: string, message: string, success: boolean = true) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'command_ack',
      room: this.config.room,
      success,
      message,
      nodeId
    }));
  }

  // Satellite sends command to Master (Compatible with both voice_command and command)
  public sendCommandToMaster(command: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const action = command.action || command.command || command.event || '';
    const query = command.query || command.rawQuery || command.track || command.artist || '';
    const volume = command.volumeValue ?? command.volume ?? command.value;
    const time = command.seekTime ?? command.time ?? command.position ?? command.targetTime;
    const offset = command.offset ?? command.seconds ?? command.delta;
    const quality = command.quality || command.playbackQuality;
    const speed = command.speed || command.playbackSpeed;

    this.ws.send(JSON.stringify({
      type: 'voice_command',
      query,
      rawQuery: command.rawQuery || query,
      action,
      volume,
      volumeValue: volume,
      seekTime: time,
      time,
      position: time,
      offset,
      quality,
      speed,
      presetName: command.presetName,
      videoId: command.videoId || command.id,
      title: command.title,
      artist: command.artist,
      nodeId: this.config.nodeId,
      nodeName: this.config.nodeName,
      room: this.config.room,
      timestamp: Date.now(),
      payload: command
    }));
  }

  // Satellite broadcasts mic activity (to show orb glow on master)
  public broadcastMicEvent(isListening: boolean) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'satellite_mic_event',
      nodeId: this.config.nodeId,
      payload: { nodeId: this.config.nodeId, isListening }
    }));
  }

  // Broadcast custom direct events (e.g. smart home updates) across connected nodes
  public broadcastDirectEvent(payload: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'direct_event',
      nodeId: this.config.nodeId,
      nodeName: this.config.nodeName,
      room: this.config.room,
      timestamp: Date.now(),
      payload
    }));
  }

  public getConnected(): boolean {
    return this.isConnected;
  }
}

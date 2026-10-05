import { Track, PlayerState } from '../types';

/**
 * ChromeMediaService
 * Ensures full compatibility with Google Chrome Extensions, Chrome Global Media Controls,
 * Hardware Media Keys, Picture-in-Picture, and Media Session API.
 */
export class ChromeMediaService {
  private static instance: ChromeMediaService;
  private silentAudio: HTMLAudioElement | null = null;
  private onPlayCallback?: () => void;
  private onPauseCallback?: () => void;
  private onNextCallback?: () => void;
  private onPrevCallback?: () => void;
  private onSeekCallback?: (time: number) => void;

  private constructor() {
    this.initSilentAudio();
    this.initExtensionMessageBridge();
  }

  public static getInstance(): ChromeMediaService {
    if (!ChromeMediaService.instance) {
      ChromeMediaService.instance = new ChromeMediaService();
    }
    return ChromeMediaService.instance;
  }

  /**
   * Initializes a top-level HTML5 audio element playing silence.
   * Crucial for Chrome extensions & Chrome toolbar media indicator to detect
   * active media even when the actual video is embedded inside a YouTube iframe.
   */
  private initSilentAudio() {
    if (typeof window === 'undefined') return;
    try {
      // 1-second silent wav data URI
      const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      this.silentAudio = new Audio(silentWav);
      this.silentAudio.loop = true;
      this.silentAudio.volume = 0.001; // Inaudible but recognized by Chrome media engine
    } catch (e) {
      console.warn('Silent audio init fallback:', e);
    }
  }

  /**
   * Register player action callbacks for MediaSession & Chrome extension triggers
   */
  public registerHandlers(handlers: {
    onPlay: () => void;
    onPause: () => void;
    onNext: () => void;
    onPrev: () => void;
    onSeek: (time: number) => void;
  }) {
    this.onPlayCallback = handlers.onPlay;
    this.onPauseCallback = handlers.onPause;
    this.onNextCallback = handlers.onNext;
    this.onPrevCallback = handlers.onPrev;
    this.onSeekCallback = handlers.onSeek;

    this.bindMediaSession();
  }

  private bindMediaSession() {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        this.onPlayCallback?.();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        this.onPauseCallback?.();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.onNextCallback?.();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.onPrevCallback?.();
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          this.onSeekCallback?.(details.seekTime);
        }
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skip = details.seekOffset || 10;
        // Broadcast seek forward
        window.dispatchEvent(new CustomEvent('serchtube:seek-relative', { detail: { offset: skip } }));
      });

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skip = details.seekOffset || 10;
        window.dispatchEvent(new CustomEvent('serchtube:seek-relative', { detail: { offset: -skip } }));
      });

      navigator.mediaSession.setActionHandler('stop', () => {
        this.onPauseCallback?.();
      });
    } catch (e) {
      console.warn('MediaSession handler bind error:', e);
    }
  }

  /**
   * Update track metadata and playback state in Chrome's media manager
   */
  public updateState(playerState: PlayerState, track: Track | null) {
    if (typeof window === 'undefined') return;

    // 1. Manage silent audio to retain Chrome Tab Media Lock
    if (playerState.isPlaying) {
      this.silentAudio?.play().catch(() => {});
    } else {
      this.silentAudio?.pause();
    }

    // 2. Media Session API
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = playerState.isPlaying ? 'playing' : 'paused';

        if (track) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist,
            album: 'SerchTube Music Cockpit',
            artwork: [
              { src: track.thumbnail, sizes: '96x96', type: 'image/jpeg' },
              { src: track.thumbnail, sizes: '128x128', type: 'image/jpeg' },
              { src: track.thumbnail, sizes: '192x192', type: 'image/jpeg' },
              { src: track.thumbnail, sizes: '256x256', type: 'image/jpeg' },
              { src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' },
            ]
          });
        }

        // Position state for scrubbers in Chrome Notification / Media control popups
        if (playerState.duration > 0 && typeof navigator.mediaSession.setPositionState === 'function') {
          navigator.mediaSession.setPositionState({
            duration: Math.max(1, playerState.duration),
            playbackRate: 1,
            position: Math.min(playerState.currentTime, playerState.duration)
          });
        }
      } catch (e) {
        // Safe ignore
      }
    }

    // 3. Dispatch standard DOM event for Chrome extensions
    window.dispatchEvent(
      new CustomEvent('serchtube:statechange', {
        detail: {
          isPlaying: playerState.isPlaying,
          track,
          currentTime: playerState.currentTime,
          duration: playerState.duration,
          volume: playerState.volume,
          isMuted: playerState.isMuted,
          nonStop: playerState.nonStop
        }
      })
    );
  }

  /**
   * Listen for window messages sent by Chrome extensions or userscripts
   */
  private initExtensionMessageBridge() {
    if (typeof window === 'undefined') return;

    window.addEventListener('message', (event) => {
      // Support messages from extensions like { type: 'SERCHTUBE_COMMAND', action: 'next' }
      if (event.data && event.data.type === 'SERCHTUBE_COMMAND') {
        const action = event.data.action;
        if (action === 'play') this.onPlayCallback?.();
        else if (action === 'pause') this.onPauseCallback?.();
        else if (action === 'next') this.onNextCallback?.();
        else if (action === 'previous') this.onPrevCallback?.();
        else if (action === 'seek' && typeof event.data.time === 'number') {
          this.onSeekCallback?.(event.data.time);
        }
      }
    });

    // Custom DOM event listener for Chrome extensions
    window.addEventListener('serchtube:command', ((e: CustomEvent) => {
      const { action, value } = e.detail || {};
      if (action === 'play') this.onPlayCallback?.();
      else if (action === 'pause') this.onPauseCallback?.();
      else if (action === 'next') this.onNextCallback?.();
      else if (action === 'previous') this.onPrevCallback?.();
      else if (action === 'seek' && typeof value === 'number') this.onSeekCallback?.(value);
    }) as EventListener);
  }
}

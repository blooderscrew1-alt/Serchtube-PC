import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type DetectedBrowser = 'edge' | 'chrome' | 'safari' | 'firefox' | 'samsung' | 'other';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [browserName, setBrowserName] = useState<DetectedBrowser>('other');

  useEffect(() => {
    // Detect standalone mode (already installed or launched from home screen)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    const isAndroidDevice = /android/.test(ua);
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    if (ua.includes('edg/') || ua.includes('edga/') || ua.includes('edge')) {
      setBrowserName('edge');
    } else if (ua.includes('samsungbrowser')) {
      setBrowserName('samsung');
    } else if (ua.includes('firefox') || ua.includes('fxios')) {
      setBrowserName('firefox');
    } else if (ua.includes('chrome') || ua.includes('crios')) {
      setBrowserName('chrome');
    } else if (isIOSDevice) {
      setBrowserName('safari');
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<'accepted' | 'dismissed' | 'manual'> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          return 'accepted';
        }
        return 'dismissed';
      } catch (err) {
        console.warn('PWA install prompt error:', err);
      }
    }
    return 'manual';
  };

  return {
    isInstallable: true, // Always offer install options when not running standalone
    canPromptDirectly: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    browserName,
    install
  };
}

// Web-layer update settings. Change UPDATE_SERVER for your GitHub Pages site.
export const UPDATE_CONFIG = {
  // Native Android Capacitor builds must not install a remote cached app shell,
  // because it can serve stale JS/CSS that differs from the bundled APK contents.
  UPDATE_ENABLED: typeof window !== 'undefined' ? !window.Capacitor?.isNativePlatform?.() : true,
  DEVELOPMENT_MODE: false,
  UPDATE_SERVER: 'https://johnpaulbugayong14-cmd.github.io/mycollab/updates/',
  UPDATE_CHECK_INTERVAL_MS: 6 * 60 * 60 * 1000,
  BUNDLED_VERSION: '1.1.45',
  UPDATE_TIMEOUT_MS: 15000,
  KEEP_RELEASES: 2
};

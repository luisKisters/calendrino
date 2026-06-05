# Building Calendrino

V0 targets **Android** (primary) and **macOS / desktop**. The same React frontend
also runs in the browser for quick UI iteration (`npm run dev`).

## Prerequisites (all platforms)

- **Node 20+** and npm
- **Rust** via [rustup](https://rustup.rs) (`rustc`, `cargo` on `PATH`)
- Project deps installed: `npm install`

## Desktop (macOS / Windows / Linux)

```bash
npm run tauri dev      # dev with hot reload
npm run tauri build    # production bundle (.app/.dmg on macOS)
```

macOS code-signing/notarization (for distribution) is configured under
`src-tauri/tauri.conf.json` → `bundle` and via Apple Developer credentials; not
required for local runs.

## Android  (M1 / M9)

> This machine did not have the Android toolchain installed, so these steps are
> documented for you to run. Everything in the app is already wired for it.

1. **Install Android Studio**, then via the SDK Manager install:
   - Android SDK Platform (API 34+)
   - Android SDK Platform-Tools
   - **NDK** (Side by side)
   - Android SDK Command-line Tools
2. **Environment variables** (add to your shell profile):
   ```fish
   set -x ANDROID_HOME $HOME/Library/Android/sdk
   set -x NDK_HOME $ANDROID_HOME/ndk/(ls $ANDROID_HOME/ndk | sort | tail -1)
   ```
   (bash/zsh: `export ANDROID_HOME=$HOME/Library/Android/sdk` etc.)
3. **Add Rust Android targets**:
   ```bash
   rustup target add aarch64-linux-android armv7-linux-androideabi \
     i686-linux-android x86_64-linux-android
   ```
4. **Initialize + run**:
   ```bash
   npm run tauri android init      # generates src-tauri/gen/android
   npm run tauri android dev       # run on emulator/device
   ```
5. **Release build & signing** (M9):
   ```bash
   npm run tauri android build     # produces an .aab / .apk
   ```
   Create an upload keystore and configure signing in the generated
   `src-tauri/gen/android` Gradle project (or via Play App Signing). See
   <https://v2.tauri.app/distribute/google-play/>.

## iOS (later)

Requires macOS + Xcode and an Apple Developer account.

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
npm run tauri ios init
npm run tauri ios dev
```

## Continuous integration (Android APK)

[`.github/workflows/android.yml`](.github/workflows/android.yml) builds an
Android APK on every push to the **`release`** branch (and via manual "Run
workflow"). Each run uploads the APK as a workflow artifact and attaches it to a
GitHub **pre-release** tagged `android-build-<run#>`.

- **Without signing secrets** it builds an installable **debug** APK.
- **With signing secrets** it builds a **signed release** APK. Add these repo
  secrets (Settings → Secrets and variables → Actions):
  - `ANDROID_KEY_ALIAS` — your key alias
  - `ANDROID_KEY_PASSWORD` — keystore / key password
  - `ANDROID_KEY_BASE64` — `base64 -i upload-keystore.jks` of your keystore

To get the app on a phone: push to `release`, then download the APK from the
run's artifacts or the generated pre-release and install it.

## Notes

- **Permissions / capabilities** live in `src-tauri/capabilities/default.json`.
  The HTTP plugin scope there whitelists the Gemini endpoint
  (`https://generativelanguage.googleapis.com/*`); add hosts if you switch
  providers (e.g. an AI Gateway endpoint).
- **Mobile camera/mic**: V0 uses a web `<input capture>` for the camera (no extra
  permission plumbing). Voice capture (microphone) is a later milestone and will
  need `NSMicrophoneUsageDescription` (iOS) and `RECORD_AUDIO` (Android).

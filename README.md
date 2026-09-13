# Auto Skip Intro v1.0

Auto Skip Intro is a lightweight browser extension that automatically clicks visible "Skip Intro" and "Skip Recap" buttons on supported streaming websites.

## Supported sites

- Netflix
- Disney+
- Hulu
- Max
- Prime Video

Support may vary because streaming websites frequently change their page structure.

## What it does

The extension checks the active streaming page for visible skip controls and clicks them when found.

It does **not** bypass DRM, modify video streams, download video, remove ads, or access protected media content.

## Recommended settings

- Enabled: on
- Skip Intro: on
- Skip Recap: on
- Skip Credits: off
- Debug Overlay: off unless testing

## Install for private testing

1. Download and unzip the extension folder.
2. Open Chrome or Edge.
3. Go to `chrome://extensions/` or `edge://extensions/`.
4. Turn on Developer Mode.
5. Click **Load unpacked**.
6. Select the unzipped `auto-skip-intro-v1.0` folder.
7. Refresh the streaming site.

## Release notes

### v1.0.0

- Stable release candidate based on the working v0.9 build.
- Lightweight scanning to avoid interfering with streaming site loading.
- Debug overlay off by default.
- Skip Credits off by default.
- Includes Chrome Web Store draft materials.

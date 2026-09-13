# Permissions Explanation

Auto Skip Intro requests the following permissions:

## storage

Used to save extension settings, such as whether Skip Intro, Skip Recap, or Debug Overlay is enabled.

## activeTab and tabs

Used so the popup can communicate with the active streaming tab when the user clicks "Test Scan Current Page" or "Force Click Skip Intro."

## Host permissions for supported streaming sites

Used so the content script can look for visible skip buttons on supported streaming websites.

Supported host permissions include:

- netflix.com
- disneyplus.com
- hulu.com
- max.com
- primevideo.com

The extension does not access unrelated websites.

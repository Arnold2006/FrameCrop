/**
 * install.js – Install Node.js dependencies for FrameCrop
 *
 * Sharp requires platform-specific native binaries. This script ensures they
 * are properly installed regardless of the host OS by:
 * 1. Cleaning any prior broken sharp installs
 * 2. Installing all dependencies with --force to ensure platform binaries are fetched
 * 3. Verifying sharp can actually be loaded
 */
module.exports = {
  run: [
    {
      method: "shell.run",
      params: {
        message: "npm cache clean --force",
      },
    },
    {
      method: "shell.run",
      params: {
        message: "npm install --force",
      },
    },
    {
      method: "shell.run",
      params: {
        message: "node -e \"require('sharp'); console.log('sharp OK')\"",
      },
    },
    {
      method: "notify",
      params: {
        html: "✅ <b>FrameCrop</b> installed! Click <b>Start</b> to launch.",
      },
    },
  ],
};

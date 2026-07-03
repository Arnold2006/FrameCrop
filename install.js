/**
 * install.js – Install Node.js dependencies for FrameCrop
 *
 * Uses Jimp (pure JavaScript) so no native binary compilation is needed.
 * A simple npm install is sufficient on all platforms.
 */
module.exports = {
  run: [
    {
      method: "shell.run",
      params: {
        message: "npm install",
      },
    },
    {
      method: "shell.run",
      params: {
        message: "node -e \"const { Jimp } = require('jimp'); require('express'); console.log('All dependencies OK')\"",
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

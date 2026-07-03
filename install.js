/**
 * install.js – Install Node.js dependencies for FrameCrop
 */
module.exports = {
  run: [
    {
      method: "shell.run",
      params: {
        message: "npm install --include=optional",
      },
    },
    {
      method: "shell.run",
      params: {
        message: "npm rebuild sharp",
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

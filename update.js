/**
 * update.js – Pull latest changes and reinstall dependencies
 */
module.exports = {
  run: [
    {
      method: "shell.run",
      params: {
        message: "git pull",
      },
    },
    {
      method: "shell.run",
      params: {
        message: "npm install",
      },
    },
    {
      method: "notify",
      params: {
        html: "✅ <b>FrameCrop</b> updated successfully! Click <b>Start</b> to launch.",
      },
    },
  ],
};

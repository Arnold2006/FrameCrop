/**
 * reset.js – Remove node_modules so the user can reinstall fresh
 */
module.exports = {
  run: [
    {
      method: "shell.run",
      params: {
        message: "rm -rf node_modules package-lock.json",
      },
    },
    {
      method: "notify",
      params: {
        html: "🗑️ <b>FrameCrop</b> dependencies removed. Click <b>Install</b> to reinstall.",
      },
    },
  ],
};

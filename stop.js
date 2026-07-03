/**
 * stop.js – Stop the FrameCrop server
 */
module.exports = {
  run: [
    {
      method: "script.stop",
      params: {
        uri: "start.js",
      },
    },
    {
      method: "notify",
      params: {
        html: "🛑 <b>FrameCrop</b> server stopped.",
      },
    },
  ],
};

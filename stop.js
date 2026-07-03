/**
 * stop.js – Stop the FrameCrop server
 */
module.exports = {
  run: [
    {
      method: "script.stop",
      params: {
        uri: "{{self.dir}}/start.js",
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

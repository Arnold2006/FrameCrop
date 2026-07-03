/**
 * start.js – Launch the FrameCrop Express server and open the web UI
 */
module.exports = {
  daemon: true,
  run: [
    {
      method: "shell.run",
      params: {
        message: "node server/index.js",
        on: [
          {
            event: "/FrameCrop server ready on port (\\d+)/",
            done: true,
          },
        ],
      },
    },
    {
      method: "local.set",
      params: {
        url: "http://localhost:{{input.event[1]}}",
      },
    },
    {
      method: "browser.open",
      params: {
        uri: "{{local.url}}",
      },
    },
  ],
};

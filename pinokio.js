/**
 * pinokio.js – Pinokio 7.x app descriptor for FrameCrop
 */
module.exports = {
  version: "4.0",
  title: "FrameCrop",
  description:
    "Batch-crop images to a chosen aspect ratio using a draggable/resizable crop overlay on each image thumbnail.",
  icon: "icon.png",
  menu: async (kernel, info) => {
    const installing = info.running("install.js");
    const running = info.running("start.js");
    const installed = info.exists("node_modules");

    if (installing) {
      return [{
        default: true,
        icon: "fa-solid fa-spinner fa-spin",
        text: "Installing…",
        href: "install.js",
      }];
    }

    if (!installed) {
      return [{
        default: true,
        icon: "fa-solid fa-download",
        text: "Install",
        href: "install.js",
      }];
    }

    if (running) {
      return [
        {
          default: true,
          icon: "fa-solid fa-stop",
          text: "Stop",
          href: "stop.js",
        },
      ];
    }

    return [
      {
        default: true,
        icon: "fa-solid fa-play",
        text: "Start",
        href: "start.js",
      },
      {
        icon: "fa-solid fa-download",
        text: "Install",
        href: "install.js",
      },
      {
        icon: "fa-solid fa-trash",
        text: "Reset",
        href: "reset.js",
      },
    ];
  },
};

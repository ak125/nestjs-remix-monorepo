exports.probeFixture = ({
  duration = "1",
  width = 1080,
  height = 1920,
  fps = 30,
  audio = false,
} = {}) => ({
  format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration },
  streams: [
    {
      codec_type: "video",
      codec_name: "h264",
      width,
      height,
      avg_frame_rate: `${fps}/1`,
      nb_frames: String(Math.round(Number(duration) * fps)),
      duration,
      start_time: "0",
      disposition: { attached_pic: 0 },
    },
    ...(audio
      ? [
          {
            codec_type: "audio",
            codec_name: "aac",
            channels: 2,
            sample_rate: "48000",
            duration,
            start_time: "0",
          },
        ]
      : []),
  ],
});

// Adapt the fake media files to the inspector's inherited descriptor boundary.
function mockMediaDescriptors(mock) {
  const fs = require("node:fs");
  const cp = require("node:child_process");
  const read = fs.readFileSync,
    open = fs.openSync,
    close = fs.closeSync;
  const execute = cp.execFileSync;
  const paths = new Map();
  let next = 900000;
  mock.method(fs, "openSync", (path, ...args) => {
    if (typeof path !== "string" || !path.startsWith("/tmp/"))
      return open(path, ...args);
    const fd = next++;
    paths.set(fd, path);
    return fd;
  });
  mock.method(fs, "readFileSync", (path, ...args) =>
    read(paths.get(path) ?? path, ...args),
  );
  mock.method(fs, "closeSync", (fd) => {
    if (!paths.delete(fd)) close(fd);
  });
  mock.method(cp, "execFileSync", (command, args, options) =>
    execute(
      command,
      command === "ffprobe"
        ? args.map((arg) =>
            arg === "/proc/self/fd/3" ? paths.get(options.stdio[3]) : arg,
          )
        : args,
      options,
    ),
  );
}
module.exports.mockMediaDescriptors = mockMediaDescriptors;

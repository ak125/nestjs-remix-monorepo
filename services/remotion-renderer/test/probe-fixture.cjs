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

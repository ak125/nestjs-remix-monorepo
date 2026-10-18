# Renderer: local technical validation

`npm test` runs the isolated regression suite. `npm run test:media` requires
FFmpeg/ffprobe (including libx264, libx265 and AAC) and generates tiny synthetic
clips in temporary directories. It calls no provider, object storage or database.
`npm run build` checks TypeScript.

## Bind an existing manifest to an existing MP4

```sh
npm run verify:manifest -- /absolute/render-manifest.json /absolute/render.mp4
```

This read-only command validates the existing `render-manifest` **1.0.0** subset:
codec, dimensions, frame rate/count, duration, audio intent, actual byte count and
SHA-256. When present, `approvalBinding.boundSha256` must bind the same file.
Exit 0 reports `TECHNICAL_MATCH` and `humanReview: NOT_ASSESSED`; exit 1 reports
`TECHNICAL_MISMATCH`. It never edits the manifest or grants approval.

The shared inspector is also used before `/render` upload and for every resized
variant before `/postprocess` uploads any artifact. Response `inspection` records
measurements and SHA-256 of the inspected file. `/render` accepts MP4 only; a WebM
request is rejected rather than silently producing MP4. Supported video codecs
are H264 and HEVC (exposed as `h265`), with AAC for expected audio. Exactly one
video stream and at most one audio stream are accepted. A declared audio URL
requires an audio track; a muted manifest forbids one.

Timing tolerances are one frame for video and max(100 ms, two frames) for audio
packet padding. Missing measurements, mismatched frames/dimensions/codecs,
unexpected tracks and inconsistent timing reject the artifact.

These checks inspect container/stream metadata; they do not decode every frame,
detect silence, establish speech intelligibility or validate visual quality.
The real-file tests use synthetic media, not the historical pilot. SHA-256 is
checked before and after inspection, not atomically across an eventual upload.
The Linux inspector passes an inherited open file descriptor to ffprobe, so
renaming/replacing its path cannot switch the probed file away from the hashed
one. The descriptor is closed on both success and failure. Symlinks are rejected,
checksums are read through the same descriptor, and device/inode identity is
checked before returning. The read-only open creates no file and changes no
permissions; its explicit mode 0600 is only a defensive creation default.
The existing audio merge uses `-shortest`; variant checks compare to its processed
input. An original-duration requirement must also be checked against the manifest.

The proposed manifest 1.1.0, content-addressed storage keys and D18/D19 approval
workflow remain outside this change pending canonical contract/owner decisions.
No historical manifest is rewritten and no backend is activated.

## Execution result transport

The backend preserves the master inspection in `renderMetadata.inspection` and
returns the existing execution JSON as `postprocessVariants` (including each
variant's `inspection`), alongside `postprocessDurationMs` and `srtS3Path`.
Missing historical values remain `null`; no observation or approval is invented.
These fields transport renderer observations without revalidating stored bytes.
The separate `/variants` endpoint continues to return its historical summary.

`PostprocessService` refuses success when a variant write fails, when the execution
JSON update fails, or when no execution row is updated. Its writes are sequential,
not transactional: an error can leave partial variant rows, and a later explicit
retry uses the existing upsert key. The execution processor does not currently
invoke this service; this change does not connect or enable it. No schema,
human review, publication eligibility, or D18/D19 decision is changed.

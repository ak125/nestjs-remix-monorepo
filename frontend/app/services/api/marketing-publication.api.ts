import { z } from "zod";

// Browser transport contract. The existing backend/SQL remains the authority
// for approval, revision checks, permissions and durable idempotency.
const mediaSchema = z
  .object({
    bucket: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,99}$/),
    path: z
      .string()
      .min(1)
      .max(512)
      .regex(/^[a-zA-Z0-9_-][a-zA-Z0-9_./-]*$/)
      .refine((path) =>
        path
          .split("/")
          .every((part) => part !== "" && part !== "." && part !== ".."),
      ),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    role: z.enum(["image", "video", "thumbnail", "subtitles"]),
  })
  .strict();

export const preparationRequestSchema = z
  .object({
    request_id: z
      .string()
      .uuid()
      .transform((value) => value.toLowerCase()),
    channel: z.enum(["facebook", "instagram", "youtube"]),
    content_revision: z.number().int().positive().safe(),
    review_version: z.number().int().nonnegative().safe(),
    account: z
      .object({
        label: z.string().trim().min(1).max(200),
        external_id: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .regex(/^[a-zA-Z0-9_.:@-]+$/),
      })
      .strict(),
    media: z
      .array(mediaSchema)
      .max(20)
      .refine(
        (items) =>
          new Set(items.map((item) => `${item.bucket}/${item.path}`)).size ===
          items.length,
      ),
  })
  .strict();

export type PreparationRequest = z.infer<typeof preparationRequestSchema>;
export type PreparationFields = Pick<PreparationRequest, "account" | "media">;
export interface PreparationTarget {
  post_id: number;
  channel: string;
  content_revision: number;
  review_version: number;
}
const recordSchema = preparationRequestSchema.extend({
  post_id: z.number().int().positive().safe(),
  actor: z.string().min(1),
  created_at: z.string().datetime({ offset: true }),
  editorial_snapshot: z.record(z.string(), z.unknown()),
  approval_snapshot: z
    .object({
      state: z.literal("approved"),
      content_revision: z.number().int().positive().safe(),
      actor: z.string().min(1),
      decided_at: z.string().datetime({ offset: true }),
    })
    .passthrough(),
});
export type PreparationRecord = z.infer<typeof recordSchema>;

export class PreparationError extends Error {
  constructor(
    public readonly kind: "conflict" | "denied" | "invalid" | "uncertain",
  ) {
    super(kind);
  }
}

const endpoint = (postId: number) =>
  `/api/admin/marketing/social/posts/${postId}/preparations`;

export async function savePreparation(
  postId: number,
  payload: PreparationRequest,
): Promise<PreparationRecord> {
  const response = await fetch(endpoint(postId), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (response.status === 409) throw new PreparationError("conflict");
  if ([401, 403].includes(response.status))
    throw new PreparationError("denied");
  if ([400, 404, 422].includes(response.status))
    throw new PreparationError("invalid");
  if (!response.ok) throw new PreparationError("uncertain");
  const envelope = z
    .object({
      preparation: recordSchema,
      publication: z.object({ ready: z.literal(false) }),
    })
    .parse(await response.json());
  const saved = envelope.preparation;
  // Re-parse into the request's canonical key order before comparison.
  const echoed = preparationRequestSchema.parse({
    request_id: saved.request_id,
    channel: saved.channel,
    content_revision: saved.content_revision,
    review_version: saved.review_version,
    account: saved.account,
    media: saved.media,
  });
  if (
    saved.post_id !== postId ||
    saved.approval_snapshot.content_revision !== payload.content_revision ||
    JSON.stringify(echoed) !==
      JSON.stringify(preparationRequestSchema.parse(payload))
  ) {
    throw new PreparationError("uncertain");
  }
  return saved;
}

export async function loadPreparations(
  postId: number,
  signal?: AbortSignal,
): Promise<PreparationRecord[]> {
  const response = await fetch(endpoint(postId), {
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) throw new Error("History unavailable");
  const result = z
    .object({
      purpose: z.literal("preparation_history"),
      publication_ready: z.literal(false),
      data: z.array(recordSchema).max(50),
    })
    .parse(await response.json());
  if (
    result.data.some(
      (record) =>
        record.post_id !== postId ||
        record.approval_snapshot.content_revision !== record.content_revision,
    )
  ) {
    throw new Error("Inconsistent preparation history");
  }
  return result.data;
}

/** Download only the selected server preparation after its current-content check. */
export async function downloadPreparation(
  expected: PreparationRecord,
): Promise<void> {
  const response = await fetch(
    `${endpoint(expected.post_id)}/${encodeURIComponent(expected.request_id)}/export`,
    {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    },
  );
  if ([404, 409].includes(response.status))
    throw new PreparationError("conflict");
  if ([401, 403].includes(response.status))
    throw new PreparationError("denied");
  if (!response.ok) throw new PreparationError("uncertain");
  const raw: unknown = await response.json();
  const parsed = z
    .object({
      schema_version: z.literal(1),
      purpose: z.literal("bound_publication_preparation"),
      export_id: z.literal(`preparation:${expected.request_id}`),
      preparation: recordSchema,
      editorial: z.object({
        post_id: z.literal(expected.post_id),
        content_revision: z.literal(expected.content_revision),
        content_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        content_snapshot: z.object({ channel: z.literal(expected.channel) }),
      }),
      publication: z.object({
        ready: z.literal(false),
        blockers: z.array(z.string()).min(1),
      }),
    })
    .parse(raw);
  // Schema parsing gives the declarative fields a deterministic key order.
  // The server snapshots remain untouched in the downloaded JSON (hash order).
  const {
    editorial_snapshot: _oldContent,
    approval_snapshot: _oldReview,
    ...oldBinding
  } = recordSchema.parse(expected);
  const {
    editorial_snapshot: _content,
    approval_snapshot: _review,
    ...binding
  } = parsed.preparation;
  if (
    JSON.stringify(binding) !== JSON.stringify(oldBinding) ||
    parsed.preparation.approval_snapshot.content_revision !==
      expected.content_revision
  ) {
    throw new PreparationError("uncertain");
  }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(raw, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  const revoke = URL.revokeObjectURL.bind(URL);
  link.href = url;
  link.download = `preparation_${expected.request_id}.json`;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Let the browser start the download before releasing its object URL.
    setTimeout(() => revoke(url), 1000);
  }
}

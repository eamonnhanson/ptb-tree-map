# Staff video uploads (v1)

The staff uploader persists a short video through the same `photo_uploads_review`
receipt boundary as staff photos, with `upload_context = 'staff_upload'` and
`file_type = 'video'`. The original stored object URL is used; videos do not go
through image resize, crop, preview, or AI image-description processing.

## API contract

The uploader must send `file_type: 'video'`, `upload_type: 'video'`, staff
identity, category, stored object URL, `mime_type`, `original_filename`, and
`original_file_size_bytes`. It may send `duration_seconds` after reading browser
video metadata. The API accepts `video/mp4`, `video/quicktime`, and `video/webm`.
It rejects videos larger than 75 MiB (78,643,200 bytes), unsupported MIME types,
and durations greater than 60 seconds when duration is supplied.

Duration is enforced client-side in v1 before storage. The backend has no video
bytes or media-probe service, so it validates a supplied duration when available
but cannot independently inspect a stored object without adding ffmpeg or a new
media service.

Videos start `pending` and `private`; they are not automatically published like
the pre-existing staff-photo workflow. The existing review/publication path must
approve and make a video public before a gallery client renders it with an HTML5
`<video controls preload="metadata">` element.

The `photo_uploads_review_staff_receipt_unique` partial unique index continues to
make `(staff_id, cropped_file_url)` idempotent for all staff uploads. A response
is successful only after that insert returns its durable `review_id`; a failed
video receipt returns `RECEIPT_PERSISTENCE_FAILED`.

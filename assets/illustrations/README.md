# Illustration assets

Per-skeleton **reusable flat-vector scene libraries**. Built once as an offline asset step, hand-curated, then reused across every story generated from that skeleton. We do **not** generate a fresh image per story instance.

Expected layout (once we have a skeleton):

```
assets/illustrations/
  <skeleton-id>/
    scene-01.<ext>      # high-res, print-DPI source art
    scene-02.<ext>
    ...
    manifest.json       # scene → skeleton-beat mapping, safe text areas, DPI
```

The pipeline composites the child's name / story text onto these scenes at assembly time.

**Open (PROJECT_STATUS B-2):** which image-gen tool produces this art, and confirmation of commercial + print usage rights for a paid product. The pipeline reads from this static folder, so that decision can be made in parallel without blocking code.

# Print order sheet

Send the printer the plain PDF (`name.pdf`). The `-proof.pdf` has trim, safe-area and die-cut guides drawn on it, for checking only. Every file includes 0.125 in bleed.

| Piece | File | Finished size | Sides | Stock | Notes |
|---|---|---|---|---|---|
| Door hanger | `door-hanger.pdf` | 4.25 x 11 in | 2 (front dark, back light) | 14 pt **uncoated or matte** | Standard 1.25 in hole, 1 in below top. Reps write on the front, so no gloss or UV coating: a ballpoint skips on it. |
| Appointment card | `appointment-card.pdf` | 3.5 x 2 in | 2 (front white, back dark) | 16 pt **uncoated or matte** | Setter writes day, window, inspector and their own name on the white side. |
| Yard sign | `yard-sign-24x18.pdf` | 24 x 18 in | 1 | 4 mm corrugated plastic | H-stake. Goes in the yard of a finished job, with the owner's OK. |
| Banner | `banner-72x36.pdf` | 6 x 3 ft | 1 | 13 oz vinyl | Hemmed, grommets in the corners and every 2 ft. |

The door hanger back uses the finished-roof photo from the website (`public/photos/new-roof.jpg`) as a placeholder. Swap in a real PowerEdge job photo before a large run: one line in `src/door-hanger.html`.

QR codes all go to poweredgetx.com/roof-claim-check, each tagged with its own source (door hanger, yard sign, banner), so scans show up separately in analytics.

## Changing a piece

The artwork is built from `src/`: edit the `.html`, then run

```
python3 print/src/build.py              # all pieces
python3 print/src/build.py door-hanger  # one piece
```

That regenerates the PDFs and the preview PNGs. Needs Google Chrome, Node 22+ and the Python packages `qrcode` and `Pillow`.

## Rules every piece follows

- Never "licensed". Texas does not license roofers. Say insured, and $2M liability.
- No deductible financing on anything a rep hands out unasked. It is on the website; at the door it comes up only after the homeowner says the deductible is the problem.
- No promise about a claim outcome ("a new roof for just your deductible").
- No em dashes.

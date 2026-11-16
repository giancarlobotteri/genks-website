"""Trace GENKS logos into true vector SVG paths (potrace) and write them out.
Usage: python3 -I trace.py <symbol.png> <wordmark.jpeg> <outdir>
"""
import sys, numpy as np
from PIL import Image
import potrace

sym_path, word_path, out = sys.argv[1:4]


def path_d(mask, ox=0.0, oy=0.0, scale=1.0, turd=4, alpha=1.0, opttol=0.2):
    bm = potrace.Bitmap(~mask)
    plist = bm.trace(turdsize=turd, alphamax=alpha, opticurve=True, opttolerance=opttol)
    parts = []
    f = lambda p: f"{(p.x*scale+ox):.2f} {(p.y*scale+oy):.2f}"
    for curve in plist:
        parts.append("M" + f(curve.start_point))
        for seg in curve.segments:
            if seg.is_corner:
                parts.append("L" + f(seg.c) + "L" + f(seg.end_point))
            else:
                parts.append("C" + f(seg.c1) + " " + f(seg.c2) + " " + f(seg.end_point))
        parts.append("Z")
    return "".join(parts)

# ---------- Symbol ----------
im = np.array(Image.open(sym_path).convert("RGB")).astype(int)
cx, cy = 659.5, None
# find vertical centre from the outer blue disc on column cx
col = im[:, int(cx)]
blue = (col[:, 2] > 200) & (col[:, 0] < 120)
ys = np.where(blue)[0]
cy = (ys.min() + ys.max() + 1) / 2
R_out = (ys.max() + 1 - ys.min()) / 2
print("symbol centre", cx, cy, "R", R_out)
H, W = im.shape[:2]
yy, xx = np.mgrid[0:H, 0:W]
rr = np.hypot(xx + 0.5 - cx, yy + 0.5 - cy)
dark = (im.sum(axis=2) < 150)
# inner artwork: everything dark inside the big blue ring (r < 400)
inner = dark & (rr < 400)
# radii of the rings measured on the horizontal axis
row = im[int(cy)]
def edges(r):
    d = r.sum(axis=1) < 150
    return np.where(np.diff(d.astype(int)) != 0)[0] + 1
print("row edges", edges(row))
inner_d = path_d(inner, ox=-cx, oy=-cy)
# ring radii (from measurement on the central row, symmetric about cx)
R_dark_out, R_dark_in = 450.0, 408.0
sym_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-466 -466 932 932" role="img" aria-labelledby="t">
<title id="t">GENKS simbolo</title>
<circle r="{R_out:.1f}" fill="#4876F7"/>
<path fill="#020918" fill-rule="evenodd" d="M{R_dark_out} 0A{R_dark_out} {R_dark_out} 0 1 0 -{R_dark_out} 0A{R_dark_out} {R_dark_out} 0 1 0 {R_dark_out} 0ZM{R_dark_in} 0A{R_dark_in} {R_dark_in} 0 1 1 -{R_dark_in} 0A{R_dark_in} {R_dark_in} 0 1 1 {R_dark_in} 0Z"/>
<path fill="#020918" d="{inner_d}"/>
</svg>
'''
open(f"{out}/genks-symbol.svg", "w").write(sym_svg)

# ---------- Wordmark ----------
wm = np.array(Image.open(word_path).convert("RGB")).astype(float)
lum = wm @ np.array([0.2126, 0.7152, 0.0722])
# chrome letters + blue glow outlines: anything clearly brighter than the black field
H2, W2 = lum.shape
yy2, xx2 = np.mgrid[0:H2, 0:W2]
# exclude the outer circular frame (measured ~ r 545..610 around the badge centre)
bx, by = 660, 678
r2 = np.hypot(xx2 - bx, yy2 - by)
inside = r2 < 520
mask = (lum > 70) & inside
word_d = path_d(mask, turd=12, alpha=1.0)
word_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="140 440 1040 470" role="img" aria-labelledby="t">
<title id="t">GENKS</title>
<defs><linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#c8cbd5"/><stop offset=".55" stop-color="#6c7382"/><stop offset="1" stop-color="#e9eef8"/></linearGradient></defs>
<path fill="url(#chrome)" fill-rule="nonzero" d="{word_d}"/>
</svg>
'''
open(f"{out}/genks-wordmark-silhouette.svg", "w").write(word_svg)
np.save(f"{out}/_wordmask.npy", mask)
np.save(f"{out}/_symmask.npy", np.stack([dark & (rr < R_out + 2)]))
print("bbox wordmark", xx2[mask].min(), xx2[mask].max(), yy2[mask].min(), yy2[mask].max())

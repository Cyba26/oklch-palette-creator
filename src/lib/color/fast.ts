/**
 * Inline OKLCH → sRGB conversion for hot pixel loops.
 * Math from Björn Ottosson: https://bottosson.github.io/posts/oklab/
 * ~5× faster than going through culori per-pixel.
 *
 * Writes r/g/b bytes (0-255) into `out` at index `i..i+2`. Sets alpha at i+3.
 * Returns true if the color was in sRGB gamut.
 */
export function oklchToSrgbBytes(
	l: number,
	c: number,
	h: number,
	out: Uint8ClampedArray,
	i: number
): boolean {
	const hRad = (h * Math.PI) / 180;
	const a = c * Math.cos(hRad);
	const b = c * Math.sin(hRad);

	// OKLab → LMS (linear cone responses), cube to undo the cube root
	let l_ = l + 0.3963377774 * a + 0.2158037573 * b;
	let m_ = l - 0.1055613458 * a - 0.0638541728 * b;
	let s_ = l - 0.0894841775 * a - 1.291485548 * b;
	l_ = l_ * l_ * l_;
	m_ = m_ * m_ * m_;
	s_ = s_ * s_ * s_;

	// LMS → linear sRGB
	const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
	const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
	const bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;

	// gamut check with small epsilon for float fuzz
	const E = 0.0005;
	const inGamut = r >= -E && r <= 1 + E && g >= -E && g <= 1 + E && bl >= -E && bl <= 1 + E;
	if (!inGamut) {
		out[i] = 24;
		out[i + 1] = 24;
		out[i + 2] = 27;
		out[i + 3] = 255;
		return false;
	}

	// linear → sRGB gamma + 8-bit
	out[i] = toSrgb8(r);
	out[i + 1] = toSrgb8(g);
	out[i + 2] = toSrgb8(bl);
	out[i + 3] = 255;
	return true;
}

function toSrgb8(x: number): number {
	const c = x <= 0 ? 0 : x >= 1 ? 1 : x;
	const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
	return (v * 255 + 0.5) | 0;
}

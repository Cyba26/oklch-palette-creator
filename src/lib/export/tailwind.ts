import type { Swatch } from '../types';
import { stepName } from './css';

export function toTailwind(swatches: Swatch[], name = 'brand'): string {
	const entries = swatches
		.map((s, i) => `      '${stepName(i, swatches.length)}': '${s.hex}'`)
		.join(',\n');
	return `// tailwind.config.js excerpt
module.exports = {
  theme: {
    extend: {
      colors: {
        ${name}: {
${entries}
        }
      }
    }
  }
};`;
}

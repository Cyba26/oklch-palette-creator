import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-node : génère un serveur Node (build/) lancé par `node build`,
		// écoute sur process.env.PORT — compatible Railway.
		adapter: adapter()
	}
};

export default config;

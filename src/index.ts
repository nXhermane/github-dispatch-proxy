interface Env {
	PROXY_API_KEY: string;
	GITHUB_TOKEN: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const pathParts = url.pathname.split('/').filter(Boolean);

		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		if (pathParts.length !== 2) {
			return new Response('Invalid path. Expected format: /:owner/:repo', { status: 400 });
		}

		const [owner, repo] = pathParts;

		const proxyAuthHeader = request.headers.get('X-Proxy-Auth');
		if (!proxyAuthHeader || proxyAuthHeader !== env.PROXY_API_KEY) {
			return new Response('Unauthorized', { status: 401 });
		}

		let payload: any;
		try {
			payload = await request.json();
		} catch {
			return new Response('Invalid JSON body', { status: 400 });
		}

		if (!payload.event_type) {
			return new Response('Missing required field: event_type', { status: 400 });
		}

		const githubUrl = `https://api.github.com/repos/${owner}/${repo}/dispatches`;
		const githubResponse = await fetch(githubUrl, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
				'User-Agent': 'nxhermane-dispatch-proxy',
				'Accept': 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});

		const responseText = await githubResponse.text();
		return new Response(responseText, {
			status: githubResponse.status,
			headers: {
				'Content-Type': githubResponse.headers.get('Content-Type') || 'application/json',
			},
		});
	},
} satisfies ExportedHandler<Env>;

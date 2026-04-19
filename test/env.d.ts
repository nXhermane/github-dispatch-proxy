declare module "cloudflare:test" {
	interface ProvidedEnv extends Env {
		PROXY_API_KEY: string;
		GITHUB_TOKEN: string;
	}
}

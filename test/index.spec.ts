import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/index";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("GitHub Dispatch Proxy Worker", () => {
	const validProxyKey = "test-proxy-key-123";
	const validGithubToken = "github-token-456";

	beforeEach(() => {
		env.PROXY_API_KEY = validProxyKey;
		env.GITHUB_TOKEN = validGithubToken;
	});

	describe("Authentication", () => {
		it("returns 401 when X-Proxy-Auth header is missing", async () => {
			const request = new IncomingRequest("http://example.com/owner/repo", {
				method: "POST",
				body: JSON.stringify({ event_type: "test" }),
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(401);
		});

		it("returns 401 when X-Proxy-Auth header is incorrect", async () => {
			const request = new IncomingRequest("http://example.com/owner/repo", {
				method: "POST",
				headers: { "X-Proxy-Auth": "wrong-key" },
				body: JSON.stringify({ event_type: "test" }),
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(401);
		});
	});

	describe("Path Validation", () => {
		it("returns 400 for invalid path format", async () => {
			const request = new IncomingRequest("http://example.com/invalid", {
				method: "POST",
				headers: { "X-Proxy-Auth": validProxyKey },
				body: JSON.stringify({ event_type: "test" }),
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(400);
		});

		it("returns 405 for non-POST methods", async () => {
			const request = new IncomingRequest("http://example.com/owner/repo", {
				method: "GET",
				headers: { "X-Proxy-Auth": validProxyKey },
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(405);
		});
	});

	describe("Payload Validation", () => {
		it("returns 400 when event_type is missing", async () => {
			const request = new IncomingRequest("http://example.com/owner/repo", {
				method: "POST",
				headers: { "X-Proxy-Auth": validProxyKey },
				body: JSON.stringify({ client_payload: { key: "value" } }),
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(400);
		});

		it("returns 400 for invalid JSON body", async () => {
			const request = new IncomingRequest("http://example.com/owner/repo", {
				method: "POST",
				headers: { "X-Proxy-Auth": validProxyKey },
				body: "not-json",
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(400);
		});
	});

	describe("GitHub API Forwarding", () => {
		it("forwards request to GitHub with correct headers and payload", async () => {
			const mockGithubResponse = { status: 204, body: "" };
			const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
				new Response(mockGithubResponse.body, { status: mockGithubResponse.status })
			);

			const payload = {
				event_type: "my-event",
				client_payload: { action: "deploy", environment: "production" },
			};

			const request = new IncomingRequest("http://example.com/owner/repo", {
				method: "POST",
				headers: { "X-Proxy-Auth": validProxyKey },
				body: JSON.stringify(payload),
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(fetchSpy).toHaveBeenCalledWith(
				"https://api.github.com/repos/owner/repo/dispatches",
				{
					method: "POST",
					headers: {
						"Authorization": `Bearer ${validGithubToken}`,
						"User-Agent": "nxhermane-dispatch-proxy",
						"Accept": "application/vnd.github+json",
						"X-GitHub-Api-Version": "2022-11-28",
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				}
			);
			expect(response.status).toBe(204);

			fetchSpy.mockRestore();
		});

		it("returns GitHub error response faithfully", async () => {
			const githubError = {
				message: "Not Found",
				documentation_url: "https://docs.github.com",
			};
			const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
				new Response(JSON.stringify(githubError), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				})
			);

			const request = new IncomingRequest("http://example.com/owner/repo", {
				method: "POST",
				headers: { "X-Proxy-Auth": validProxyKey },
				body: JSON.stringify({ event_type: "test" }),
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
			expect(await response.json()).toEqual(githubError);

			fetchSpy.mockRestore();
		});
	});
});

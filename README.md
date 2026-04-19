# GitHub Dispatch Proxy

A generic, secure Cloudflare Worker proxy to trigger GitHub Repository Dispatch events for automated workflows across multiple repositories.

## 🚀 Features
- **Generic:** Trigger actions on any repository you have access to.
- **Secure:** Proxy authentication via custom `X-Proxy-Auth` header.
- **Serverless:** Built on Cloudflare Workers for lightning-fast execution.
- **Standardized:** Fully compatible with GitHub's `repository_dispatch` API.

## 🛠 Usage

### 1. Request to the Proxy
Send a `POST` request to your worker URL:

```http
POST https://your-worker-url.workers.dev/:owner/:repo
X-Proxy-Auth: <YOUR_PROXY_API_KEY>
Content-Type: application/json

{
  "event_type": "deploy-workflow",
  "client_payload": {
    "environment": "production",
    "version": "1.0.0"
  }
}
```

### 2. GitHub Action Template
To react to this dispatch event, add a workflow file (e.g., `.github/workflows/dispatch.yml`) in the target repository:

```yaml
name: Handle Dispatch

on:
  repository_dispatch:
    types: [deploy-workflow]

jobs:
  run-task:
    runs-on: ubuntu-latest
    steps:
      - name: Log payload
        run: |
          echo "Environment: ${{ github.event.client_payload.environment }}"
          echo "Version: ${{ github.event.client_payload.version }}"
```

## ⚙️ Configuration

### Secrets
The worker uses the following environment variables (set via `wrangler secret`):
- `PROXY_API_KEY`: A secret key you define to secure access to the proxy.
- `GITHUB_TOKEN`: A fine-grained GitHub token with `Contents: Read & Write` permissions.

## 🚀 Deployment

The project includes an automation script to simplify deployment:

1. Create a `.env` file based on `.env.example`.
2. Make the script executable:
   ```bash
   chmod +x deploy.sh
   ```
3. Run the deployment:
   ```bash
   ./deploy.sh
   ```

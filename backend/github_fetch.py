"""GitHub repo fetching for the login-page evaluation pipeline."""
import re
import httpx

TEXT_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx", ".vue", ".html", ".htm",
                   ".css", ".scss", ".sass", ".less", ".json", ".py", ".md"}
SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".next", "coverage",
             "public/build", ".turbo", ".cache", "vendor", "__pycache__"}
SKIP_FILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml"}
MAX_FILES = 40
MAX_FILE_BYTES = 40_000
MAX_TOTAL_BYTES = 200_000

GH_URL_RE = re.compile(r"^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$")


def parse_repo(url: str) -> tuple[str, str]:
    m = GH_URL_RE.match(url.strip())
    if not m:
        raise ValueError("Not a valid GitHub repository URL")
    owner, name = m.group(1), m.group(2)
    return owner, name


def _should_skip(path: str) -> bool:
    parts = path.split("/")
    if any(p in SKIP_DIRS for p in parts):
        return True
    if parts[-1] in SKIP_FILES:
        return True
    if not any(parts[-1].lower().endswith(ext) for ext in TEXT_EXTENSIONS):
        return True
    return False


async def fetch_repo_files(owner: str, name: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=20.0, headers={"Accept": "application/vnd.github+json",
                                                        "User-Agent": "aidev-practice"}) as client:
        repo_meta = await client.get(f"https://api.github.com/repos/{owner}/{name}")
        if repo_meta.status_code != 200:
            raise ValueError(f"GitHub repo not accessible ({repo_meta.status_code})")
        default_branch = repo_meta.json().get("default_branch", "main")

        tree_resp = await client.get(f"https://api.github.com/repos/{owner}/{name}/git/trees/{default_branch}?recursive=1")
        if tree_resp.status_code != 200:
            raise ValueError(f"Could not fetch repo tree ({tree_resp.status_code})")
        tree = tree_resp.json().get("tree", [])

        candidates = [t for t in tree if t.get("type") == "blob" and not _should_skip(t["path"])
                      and (t.get("size") or 0) <= MAX_FILE_BYTES]
        candidates.sort(key=lambda t: (0 if t["path"].split("/")[-1].lower() in
                                       {"app.js", "app.jsx", "app.tsx", "login.jsx", "login.tsx", "index.html", "main.py", "server.py"} else 1,
                                       t.get("size") or 0))
        candidates = candidates[:MAX_FILES]

        raw_base = f"https://raw.githubusercontent.com/{owner}/{name}/{default_branch}"
        results: list[dict] = []
        total = 0
        for t in candidates:
            path = t["path"]
            r = await client.get(f"{raw_base}/{path}")
            if r.status_code != 200:
                continue
            content = r.text
            if len(content) > MAX_FILE_BYTES:
                content = content[:MAX_FILE_BYTES] + "\n... (truncated)"
            if total + len(content) > MAX_TOTAL_BYTES:
                break
            total += len(content)
            results.append({"path": path, "content": content})
        if not results:
            raise ValueError("Repository contained no analyzable source files")
        return results

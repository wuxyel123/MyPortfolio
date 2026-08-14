#!/usr/bin/env python3
"""Generate projects.json: the public repositories Alessandro actually wrote code in.

Why this runs at build time rather than in the browser
------------------------------------------------------
Deciding "did I contribute to this?" needs one commits-by-author call per
repository. From a visitor's browser that is ~19 unauthenticated GitHub API
calls against a limit of 60 per hour per IP, so the projects list would start
failing for real visitors. Doing it here means the page makes zero GitHub API
calls: it just reads a static file.

Criterion
---------
A repository is included when the user authored at least one commit in it.
That is deliberately not "is not a fork": WearableProject and projects are
forks containing 31 and 6 of his own commits, while agentic_design_patterns,
git-cliff and sort are forks he never committed to.

Usage:  python3 tools/build-projects.py <output-path>
Honours GITHUB_TOKEN when present (much higher rate limit).
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

USER = "wuxyel123"
API = "https://api.github.com"

# Repositories to hide regardless of commit count.
#   projects — a fork of 2KAbhishek/projects, the script this site's project
#              section grew out of. The commits are real but it is tooling,
#              not a project worth showing.
DENYLIST = {"projects"}

TOKEN = os.environ.get("GITHUB_TOKEN", "")


def api(path, attempts=4):
    """GET with retries. A transient API error must not block an unrelated
    deploy, but a persistent one must fail the build rather than publish a
    tree with no projects.json — that would delete the good copy already on
    the server and silently drop the page back to an unfiltered list."""
    req = urllib.request.Request(
        API + path,
        headers={
            "User-Agent": "myportfolio-build",
            "Accept": "application/vnd.github+json",
            **({"Authorization": "Bearer " + TOKEN} if TOKEN else {}),
        },
    )
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                return json.load(res), res.headers
        except urllib.error.HTTPError as e:
            if e.code in (404, 409) or attempt == attempts - 1:
                raise
            # 403 here is nearly always the rate limit; back off and retry
            wait = 5 * (2 ** attempt)
            print("    %s -> HTTP %s, retrying in %ss" % (path, e.code, wait))
            time.sleep(wait)
        except Exception as e:
            if attempt == attempts - 1:
                raise
            wait = 3 * (2 ** attempt)
            print("    %s -> %s, retrying in %ss" % (path, e, wait))
            time.sleep(wait)


def authored_commits(full_name):
    """Number of commits authored by USER, via the pagination Link header."""
    try:
        data, headers = api(
            "/repos/%s/commits?author=%s&per_page=1" % (full_name, USER)
        )
    except urllib.error.HTTPError as e:
        # 409 = empty repository, 404 = no access. Neither is a contribution.
        if e.code in (404, 409):
            return 0
        raise
    if not data:
        return 0
    match = re.search(r'[?&]page=(\d+)>; rel="last"', headers.get("Link", ""))
    return int(match.group(1)) if match else len(data)


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "projects.json"

    repos, _ = api("/users/%s/repos?sort=pushed&per_page=100" % USER)
    kept = []

    for repo in repos:
        if repo["archived"] or repo["name"] in DENYLIST:
            continue

        count = authored_commits(repo["full_name"])
        status = "keep" if count else "skip"
        print("  %-4s %-60s %s commits" % (status, repo["name"], count))
        if not count:
            continue

        home = (repo.get("homepage") or "").strip()
        kept.append({
            "name": repo["name"],
            "url": repo["html_url"],
            "description": repo.get("description") or "",
            "language": repo.get("language") or "",
            "stars": repo.get("stargazers_count", 0),
            "forks": repo.get("forks_count", 0),
            "homepage": "" if "alessandrodiscalzi.com" in home else home,
            "commits": count,
            "pushed_at": repo.get("pushed_at", ""),
        })
        if not TOKEN:
            time.sleep(0.4)          # be gentle when unauthenticated

    # most-noticed first, then most recently worked on
    kept.sort(key=lambda r: (-r["stars"], -r["forks"], r["pushed_at"]), reverse=False)
    kept.sort(key=lambda r: (r["stars"], r["forks"], r["pushed_at"]), reverse=True)

    payload = {"generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
               "user": USER,
               "repos": kept}

    with open(out_path, "w") as fh:
        json.dump(payload, fh, indent=1)

    print("\nwrote %s — %d of %d repositories" % (out_path, len(kept), len(repos)))


if __name__ == "__main__":
    main()

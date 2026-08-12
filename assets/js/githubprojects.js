/* Public GitHub repositories, fetched at runtime and rendered into .repo-list.
   Originally based on 2KAbhishek/projects, rewritten for the current markup:
   no devicon dependency, text is inserted as text (not HTML), and API
   failures/rate limits degrade to a readable message instead of a blank list. */
(function () {
    'use strict';

    var USERNAME   = 'wuxyel123';
    var PER_PAGE   = 100;
    var HIDE_FORKS = false;

    var list       = document.querySelector('.repo-list');
    var filterInput = document.querySelector('.filter-repos');
    if (!list) return;

    // Accent colours for the language dot; anything unlisted falls back to grey.
    var LANG_COLORS = {
        Java: '#b07219', Python: '#3572a5', JavaScript: '#f1e05a',
        TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#563d7c',
        'C++': '#f34b7d', C: '#555555', 'C#': '#178600', Shell: '#89e051',
        Go: '#00add8', Rust: '#dea584', Ruby: '#701516', PHP: '#4f5d95',
        Kotlin: '#a97bff', Swift: '#f05138', Dart: '#00b4ab',
        'Jupyter Notebook': '#da5b0b', TeX: '#3d6117', Dockerfile: '#384d54',
        Vue: '#41b883', Scala: '#c22d40', R: '#198ce7', Lua: '#000080',
        PLpgSQL: '#336790', Makefile: '#427819', Batchfile: '#c1f12e'
    };

    function status(message) {
        list.innerHTML = '';
        var li = document.createElement('li');
        li.className = 'repo-status';
        li.textContent = message;
        list.appendChild(li);
    }

    function icon(id) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'ico');
        svg.setAttribute('aria-hidden', 'true');
        var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#' + id);
        svg.appendChild(use);
        return svg;
    }

    function metaItem(node, text) {
        var span = document.createElement('span');
        if (node) span.appendChild(node);
        span.appendChild(document.createTextNode(text));
        return span;
    }

    function linkButton(href, text, variant) {
        var a = document.createElement('a');
        a.className = 'btn ' + variant;
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = text;
        return a;
    }

    function render(repos) {
        list.innerHTML = '';

        if (!repos.length) {
            status('No public repositories to show right now.');
            return;
        }

        repos.forEach(function (repo) {
            var li = document.createElement('li');
            li.className = 'repo';

            var h3 = document.createElement('h3');
            var titleLink = document.createElement('a');
            titleLink.href = repo.html_url;
            titleLink.target = '_blank';
            titleLink.rel = 'noopener';
            titleLink.textContent = repo.name;
            h3.appendChild(titleLink);
            li.appendChild(h3);

            var desc = document.createElement('p');
            desc.className = 'repo-desc';
            desc.textContent = repo.description || 'No description provided.';
            li.appendChild(desc);

            var meta = document.createElement('div');
            meta.className = 'repo-meta';

            if (repo.language) {
                var dot = document.createElement('i');
                dot.className = 'lang-dot';
                dot.style.background = LANG_COLORS[repo.language] || '';
                meta.appendChild(metaItem(dot, repo.language));
            }
            if (repo.stargazers_count > 0) {
                meta.appendChild(metaItem(icon('i-star'), String(repo.stargazers_count)));
            }
            if (repo.forks_count > 0) {
                meta.appendChild(metaItem(icon('i-fork'), String(repo.forks_count)));
            }
            if (meta.childNodes.length) li.appendChild(meta);

            var links = document.createElement('div');
            links.className = 'repo-links';
            links.appendChild(linkButton(repo.html_url, 'Code', 'btn-outline'));

            // Ignore a homepage that just points back at this site.
            var home = (repo.homepage || '').trim();
            if (home && !/alessandrodiscalzi\.com/.test(home)) {
                links.appendChild(linkButton(home, 'Live demo', 'btn-primary'));
            }
            li.appendChild(links);

            list.appendChild(li);
        });
    }

    function getRepos() {
        status('Loading projects…');

        fetch('https://api.github.com/users/' + USERNAME +
              '/repos?sort=pushed&per_page=' + PER_PAGE)
            .then(function (res) {
                if (res.status === 403) throw new Error('rate-limit');
                if (!res.ok) throw new Error('http-' + res.status);
                return res.json();
            })
            .then(function (repos) {
                if (!Array.isArray(repos)) throw new Error('bad-payload');

                repos = repos.filter(function (repo) {
                    return !(repo.fork && HIDE_FORKS) && !repo.archived;
                });
                // Most-noticed first, then most recently pushed.
                repos.sort(function (a, b) {
                    return (b.stargazers_count - a.stargazers_count)
                        || (b.forks_count - a.forks_count)
                        || (new Date(b.pushed_at) - new Date(a.pushed_at));
                });

                render(repos);
                if (filterInput) filterInput.disabled = false;
            })
            .catch(function (err) {
                status(err.message === 'rate-limit'
                    ? 'GitHub’s API is rate limited right now. See the projects directly at github.com/' + USERNAME
                    : 'Could not load projects from GitHub. See them at github.com/' + USERNAME);
            });
    }

    if (filterInput) {
        filterInput.disabled = true;
        filterInput.addEventListener('input', function (e) {
            var query = e.target.value.toLowerCase();
            Array.prototype.forEach.call(list.querySelectorAll('.repo'), function (repo) {
                repo.classList.toggle('is-hidden', repo.innerText.toLowerCase().indexOf(query) === -1);
            });
        });
    }

    getRepos();
})();

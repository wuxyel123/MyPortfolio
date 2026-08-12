Personal website — CV and portfolio for Alessandro Discalzi
https://www.alessandrodiscalzi.com/

Structure
---------
    index.html              Single page: hero, about, resume, projects, contact.
    assets/css/main.css     Screen styles. Hand-written, no framework.
    assets/css/print.css    Printed / PDF CV (media="print"), 2 pages, links
                            rendered with their destination visible.
    assets/js/main.js       Theme toggle, mobile nav, scrollspy, dynamic dates,
                            lazy-loaded contact form.
    assets/js/githubprojects.js
                            Fetches public repos from the GitHub REST API.

No build step, no dependencies. Open index.html, or serve the folder:

    python3 -m http.server 8765

Deployment
----------
.github/workflows/main.yml FTP-syncs the repository to the web host on every
push to main. Anything committed here becomes publicly downloadable, so keep
private material out of the repo (see .gitignore).

Content that updates itself
---------------------------
    Footer year                 [data-year]
    Years of experience         [data-years-since="YYYY-MM"] in the About text
    Project list                pulled live from GitHub

Credits
-------
    Original template: JohnDoe by DevCRUD (https://www.devcrud.com/) — replaced
    in 2026 by the hand-written stylesheet, but the site's structure grew out
    of it.
    GitHub project list: based on https://github.com/2KAbhishek/projects

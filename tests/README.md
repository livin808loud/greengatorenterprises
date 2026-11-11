# Request a Truck regression test

Install the test-only dependency without changing the static site's deployment:

```sh
npm install --no-save --package-lock=false playwright
node tests/request-truck.cjs
TEST_URL=https://greengatorenterprises.com/#quote node tests/request-truck.cjs
```

Requires Google Chrome at the macOS executable path in the test. The browser exercises form fields, FormData, access selection, contact validation, provider failure/retry, success copy, and mobile/desktop horizontal overflow. Provider POST requests are intercepted with explicit simulated responses: this never creates a live lead and does not verify inbox delivery. GitHub Pages continues serving the static root site.

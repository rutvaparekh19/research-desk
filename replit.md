# Research Desk

## Run locally on Replit

```bash
npm install
npm run build
npm start
```

The `Start application` workflow runs `npm start` on port 5000. The frontend is served from `PUBLIC/`.

## Notes

- Editor source lives in `src/editor.js`; rebuild after changing it.
- Research data is persisted in the browser with `localStorage`.
- No external services or secrets are required for the current frontend.
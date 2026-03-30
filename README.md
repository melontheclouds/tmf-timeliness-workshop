# TMF Timeliness Workshop Render Repo

This folder is ready to be used as its own GitHub repository for Render Free.

## What is inside

- `kahoot-party-server.js`
- `package.json`
- `render.yaml`
- `kahoot-party/`
- `.gitignore`

## Recommended use

1. Create a new GitHub repository.
2. Upload the contents of this folder to the root of that repository.
3. In Render, create a new `Web Service`.
4. Connect that GitHub repository.
5. Render should detect `render.yaml` automatically.
6. Deploy on the `Free` plan.

## Current game setting

The current build is set up for the TMF Timeliness Workshop with `14` active questions.

If you want to change the number of questions before deploying, edit this line in `kahoot-party-server.js`:

```js
const ACTIVE_QUESTION_COUNT = 14;
```

## Notes

- The app keeps game state in memory, so a restart resets the current lobby and scores.
- On Render, the host screen will use the public Render URL automatically.
- Render Free can sleep after inactivity, so opening the host screen shortly before the game is a good idea.

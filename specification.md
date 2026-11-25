
Plot: 
I would like to create a new web browser based game based on “Wacho-o-mole” 
Only: instead of moles coming out of the holes, I would like the user to choose and upload a photo, preferably a face, and this face will be used instead of the mole .


In details: 
The user will hover a hammer and will need to hit as much as “moles” (users’ choice. For the sake of description we’ll call it moles) as possible
The game has 3 levels of difficulty, which the user chooses before the game.
The game board will include 12 holes spread all over the screen 
Game will be over after 20 moles coming out and will be considered as success if user managed to hit more than 15 
Score point screen will be presented on the left up side of the screen
The moles that are based on the users’ upload will slightly change every time they coming out (the face will be smiling / sad / angry etc.. P) 

Technical specification:
I need your help, what would be the best tech stack for this game ?

Decision: Face expression changes (smiling/sad/angry) will be done via simple pre-made sticker overlays/filters composited onto the user's uploaded photo — not real-time face warping or AI-generated expression swaps.

Recommended stack: Vite + React + plain Canvas (no backend, fully client-side).

- Rendering: 12 holes positioned via CSS grid/absolute positioning, mole pop-up/down animated with CSS transitions. A full game engine (e.g. Phaser) is unnecessary for this level of complexity.
- Face compositing: On upload, draw the photo once onto an offscreen <canvas>, layer sticker overlays (smile/sad/angry PNGs) on top at fixed anchor points, export as data URLs. Pre-rendered variants are then swapped in each time a mole pops up.
- State/logic: React state for score, selected difficulty, the 20-mole countdown, and timer-based spawn intervals per difficulty level.
- Hosting: standalone static app, separate from other apps in this workspace — no API/server needed, deployable as static files.

Tradeoff: DOM+CSS rendering is simpler to build/debug than Canvas-based rendering, but switching to Canvas later (e.g. for hammer-smash particle effects) is straightforward since the face-compositing step already uses Canvas.



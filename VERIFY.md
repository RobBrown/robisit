# Narration: checks for a real iPhone

These can't be run in automation. Playwright's WebKit isn't iOS Safari, and
headless Chrome has no speaker, no mute switch and no lock screen. Use iOS
Safari on a real iPhone, at
`https://robisit.com/thoughts/hello-world-cards/?path=pilot&card=5`, after the
`narration` branch is deployed.

| # | Check | Expected |
|---|-------|----------|
| 1 | Autoplay policy after a user gesture. Tap Play on card 5. | Audio starts on the first tap, with no second tap needed. The button shows Pause and the first phrase is underlined. |
| 2 | Autoplay policy on a cold load. Open the URL fresh and wait 10 s without touching anything. | Nothing plays. |
| 3 | Silent switch on, ringer muted. Tap Play. | Record what happens. Web audio in iOS Safari plays through the mute switch in recent iOS versions, so audio is expected. If it's silent, the underline should still advance (it follows `currentTime`), or the button should return to Play with no stuck state. Neither result is a failure, but note which one happens. |
| 4 | Silent switch toggled during playback. | No stuck underline, and the button state matches what you hear. |
| 5 | Background tab. Start narration, switch to another Safari tab for 10 s, then come back. | iOS may pause audio in the background. On return, the underline matches the audio position, and Play/Pause shows the true state (Play if iOS paused it). |
| 6 | Lock the screen during playback, then unlock. | Same as 5. No second sound starts, and the underline matches `currentTime` after unlock. |
| 7 | Underline rendering with Lora at the site's sizes (16.5 px body on desktop, 15.5 px on phones; titles 20 to 22 px bold). | The underline is a thin line under the spoken phrase, clear of descenders (g, p, y) and never touching the next line. It doesn't jump between lines or flash as phrases change. |
| 8 | Underline across a line break. Find a phrase that wraps onto the next line. | Both line fragments are underlined. The space between phrases isn't. |
| 9 | Swipe to the next card while playing. | Audio stops at once, the underline clears, and the old card's button shows Play. |
| 10 | Swipe back and forth quickly while playing (about 10 swipes in 2 s). | One sound at most, never two. No underline is left on a card that isn't playing. |
| 11 | Pause, wait 5 s, then Play. | Audio resumes where it paused, not from the start, and the underline continues from the same phrase. |
| 12 | VoiceOver on. Move to the button and double-tap. | It announces "Read this card aloud, toggle button", then "Reading card aloud." while playing, and "Finished reading." at the end. Nothing is announced per phrase. Focus stays on the button. |
| 13 | Data use. Open the page on cellular and don't press Play. | No MP3 is requested. Only the small timing JSON (about 2 KB) is fetched for the current card. Check with Safari Web Inspector over USB. |
| 14 | Bluetooth headphones. Play, then disconnect them. | Audio pauses (iOS behaviour) and the button returns to Play with the underline frozen. Play resumes from the same point. |

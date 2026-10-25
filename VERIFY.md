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
| 2a | **Checked on iPhone 2026-10-24: works** (after the touchstart unlock, PR #7). Before the fix, one swipe stayed silent. Autoplay with no Play press, by swipe. Load `?` with no parameters (the situation card), swipe once to card 1, and don't tap anything. | Card 1 starts reading about 0.35 s after the deck settles. If it doesn't, the swipe's touchend didn't count as a gesture on iOS: record that, then try 2a-ii. |
| 2a-ii | **Checked on iPhone 2026-10-24: works.** Autoplay with no Play press, by tap. Fresh load, then tap a path option on the first card. | Card 1 of that path starts reading on its own, and so does every card you swipe to after it. |
| 2a-iii | Music in another app is playing. Load the page and scroll the article without touching the deck. | Your music keeps playing. Only a gesture inside the deck takes over the audio. |
| 2b | Pause latch. While a card is reading, press Pause, then swipe through three cards. | None of them plays. Press Play on any card: it reads, and swiping on starts the next card again. |
| 2c | Lock-screen pause. While reading, pause from the lock screen or Control Center, then return and swipe. | Nothing plays, the same as a button pause. |
| 3 | Silent switch on, ringer muted. Tap Play. | Record what happens. An HTML `<audio>` element in iOS Safari normally plays with the silent switch on (unlike the Web Audio API), so audio is expected. If it's silent, the underline should still advance (it follows `currentTime`), or the button should return to Play with no stuck state. Neither result is a failure, but note which one happens. |
| 4 | Silent switch toggled during playback. | No stuck underline, and the button state matches what you hear. |
| 5 | Background tab. Start narration, switch to another Safari tab for 10 s, then come back. | iOS may pause audio in the background. On return, the underline matches the audio position, and Play/Pause shows the true state (Play if iOS paused it). |
| 6 | Lock the screen during playback, then unlock. | Same as 5. No second sound starts, and the underline matches `currentTime` after unlock. |
| 7 | Underline rendering with Lora at the site's sizes (16.5 px body on desktop, 15.5 px on phones; titles 20 to 22 px bold). | The underline is a thin line under the spoken phrase, clear of descenders (g, p, y) and never touching the next line. It doesn't jump between lines or flash as phrases change. |
| 8 | Underline across a line break. Find a phrase that wraps onto the next line. | Both line fragments are underlined. The space between phrases isn't. |
| 9 | Swipe to the next card while playing. | The old card's audio stops at once, its underline clears and its button shows Play. When the deck settles, the new card starts reading by itself. |
| 10 | Swipe back and forth quickly while playing (about 10 swipes in 2 s). | One sound at most, never two. No underline is left on a card that isn't playing. Only the card you stop on plays. |
| 11 | Pause, wait 5 s, then Play. | Audio resumes where it paused, not from the start, and the underline continues from the same phrase. |
| 12 | VoiceOver on. Move to the button and double-tap. | It announces "Read this card aloud, toggle button", then "Reading card aloud." while playing, and "Finished reading." at the end. Nothing is announced per phrase. Focus stays on the button. |
| 13 | Data use. Open the page on cellular and don't press Play. | No MP3 is requested. Only the small timing JSON (about 2 KB) is fetched for the current card. Check with Safari Web Inspector over USB. |
| 14 | Bluetooth headphones. Play, then disconnect them. | Audio pauses (iOS behaviour) and the button returns to Play with the underline frozen. Play resumes from the same point. |

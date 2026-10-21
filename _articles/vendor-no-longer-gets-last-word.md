---
layout: article
title: "The Vendor No Longer Gets the Last Word"
date: 2026-10-20
description: "For forty years, software decided what users got. AI is changing the arithmetic, and users are starting to decide for themselves."
og_image: ""
featured: false
views: 294
linkedin: 54
bluesky: 1259
read_time: "3 min"
---

Here is the shift in one sentence: "For forty years, software decided what users got. Users are starting to decide for themselves."

That sounds obvious until you remember how the business actually worked. A vendor built a product, customers bought it, learned it, and bent their work around it. When it fell short they filed a request, and most requests died in a backlog, because a feature had to pay for itself across thousands of customers or it did not get built. I ran organizations that operated this way. It was not malice. It was arithmetic, and AI is quietly changing the arithmetic. Two things this month made that concrete for me.

In early October a developer named Brandon Thomas released open-source recreations of seven Adobe apps, including a Photoshop clone called PhotoCraft, built in Rust with Claude Opus 5.5 ([PetaPixel](https://petapixel.com/2026/10/07/someone-rebuilt-free-open-source-versions-of-photoshop-premiere-and-lightroom-using-ai/)). It is a clean-room rebuild from public specs and observed behaviour. The coverage has been breathless, so some care is warranted: these are alpha. The project's own tracker had PhotoCraft under half ready for real work as of last week, and Thomas has walked back his parity claims. I would not hand it to a working designer. What stuck with me is that reproducing the shape of Photoshop, once a multi-year corporate effort, is now something a small team attempts in weeks and gets a reviewable result.

![Meet Tab Mute: mute every Meet tab from one place](/meet-tab-mute/store-assets/marquee-1400x560.png)

The smaller example changed my thinking more. My wife teaches, and she often has more than one Google Meet room open. She needed to silence individual tabs without hunting for the right speaker icon, and nothing we found did it cleanly. So I built [Meet Tab Mute](https://robisit.com/meet-tab-mute/), a Chrome extension that lists every open Meet call with a mute checkbox beside it. I have no idea how to write a Chrome extension. I still don't. Here is what I actually did:

- Spent about 30 minutes planning and writing a PRD.
- Handed it to Claude Code with instructions to work autonomously, set up Playwright for its own testing, and deliver a finished result.
- Let AI handle the Chrome Web Store setup and submission.
- Synthetic tests run daily, because a Chrome update will eventually break it.
- When they fail, an agent opens a PR with the fix. I review, merge, and the store listing updates.
- An agent watches the support inbox. Bug reports become PRs. Feature requests become Jira epics.

The whole interface is a list and some checkboxes, and I mean that as a description, not modesty. The operating model around it is the interesting part.

No company would have built that. There is no market for it. For my entire career that meant the problem stayed a problem. Now it is solved for one person, and one person is no longer too few.

I do not think this kills commercial software. The page for my extension warns that a Chrome update could break it and nobody is on call. Vendors still own reliability, integration, security, and the phone that rings when something fails. What they are losing is the part they took for granted: being the only ones who decide what the software does.

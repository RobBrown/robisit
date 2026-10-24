---
layout: article
title: "Hello, World: Insight Cards Test Page"
date: 2026-10-24
description: "Test page for the Insight Cards feature. Not a real article."
og_image: ""
featured: false
unlisted: true
views: 0
read_time: "1 min"

# TEST PAGE: placeholder card content for exercising the Insight Cards deck.
# Card bodies are written near the 90-word ceiling on purpose, to test fit.
cards:
  situation:
    prompt: "Hello! Which test path do you want?"
    options:
      - id: basics
        label: "Show me the basics"
        order: [hello, counter, swipe, reveal, links]
        anchor: "#hello-world"
      - id: order
        label: "Test a reordered deck"
        order: [links, reveal, swipe, counter, hello]
        anchor: "#second-section"
      - id: pilot
        label: "Test deep links (pilot path)"
        order: [swipe, links, hello, reveal, counter]
        anchor: "#third-section"
  default_order: [hello, counter, swipe, reveal, links]
  default_anchor: "#hello-world"
  insights:
    - id: hello
      title: "Hello, world: this is a test card"
      body: "This page exists to test the Insight Cards feature on robisit.com. It is not a real article, and nothing on it is advice. If you found it by accident, hello, and sorry for the detour. Each card on this page is written close to the ninety-word ceiling so the deck can be checked on small phones. A real card would teach one complete idea here: the claim, why it holds, and what to do about it."
    - id: counter
      title: "Test card two checks the counter"
      body: "The small number at the top of this card should read two of six when you arrive in the default order. The situation card is not counted, and the last card is. Pick a different path on the first card and this card moves, but the counter stays positional, so it always tells you where you are in the deck rather than which card this is. This sentence is filler to bring the body close to the word ceiling."
    - id: swipe
      title: "Test card three checks swiping and keys"
      body: "Swipe sideways to move between cards. On a laptop, use the arrow keys or hover over the deck to show the chevrons. Scrolling up and down over the deck should move the page, never the cards. Navigation stops at the first and last card without wrapping around. The address bar should change as you move, so copying it shares the card you are on. This sentence is filler to bring the body close to the word ceiling."
    - id: reveal
      title: "Test card four checks the reveal"
      body: "Under the deck there is one link that opens the full article from the top. The last card has a button that opens it at the section matching the path you picked on the first card. Either way, the link under the deck disappears, the page scrolls to the right heading, and keyboard focus moves there too. The cards stay above the article afterwards. This sentence is filler to bring the body close to the ninety-word ceiling."
    - id: links
      title: "Test card five checks deep links"
      body: "Open this page with a path and card in the address, such as path equals pilot and card equals three, and the deck should apply that path and land on that card straight away, with no animation. An unknown path is ignored and a card number past the end lands on the last card. Other parts of the address, such as campaign tags, are kept. This sentence is filler to bring the body close to the ninety-word ceiling."
  terminal:
    knows: "That is the whole test deck: five cards, three paths, and one way into the page below."
    resolves: "The page below is a short placeholder with three headings, one for each path's entry point. It is not a real article either."
---

This is a test page for the Insight Cards feature. It is not a real article. If you landed here by accident, there is nothing to read. Head back to [all articles](/content).

## Hello, world

The "Show me the basics" path and the default deck open the page here.

Placeholder paragraph one. The quick brown fox jumps over the lazy dog.

Placeholder paragraph two. The quick brown fox jumps over the lazy dog.

## Second section

The "Test a reordered deck" path opens the page here.

Placeholder paragraph three. The quick brown fox jumps over the lazy dog.

Placeholder paragraph four. The quick brown fox jumps over the lazy dog.

## Third section

The "Test deep links" path opens the page here.

Placeholder paragraph five. The quick brown fox jumps over the lazy dog.

Placeholder paragraph six. The quick brown fox jumps over the lazy dog.

That is the end of the test page.

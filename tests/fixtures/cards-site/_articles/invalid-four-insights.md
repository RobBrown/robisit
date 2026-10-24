---
layout: article
title: Fixture invalid-four-insights
date: '2026-01-01'
cards:
  situation:
    prompt: Which is closest?
    options:
      - id: one
        label: One
        order:
          - b
          - a
          - c
          - d
        anchor: '#second-section'
      - id: two
        label: Two
        order:
          - d
          - c
          - b
          - a
        anchor: '#third-section'
  default_order:
    - a
    - b
    - c
    - d
  default_anchor: '#first-section'
  insights:
    - id: a
      title: Claim a
      body: Body for a.
    - id: b
      title: Claim b
      body: Body for b.
    - id: c
      title: Claim c
      body: Body for c.
    - id: d
      title: Claim d
      body: Body for d.
  terminal:
    knows: You know it.
    resolves: The article adds more.
---

## First section

Text.

## Second section

Text.

### Third section

Text.

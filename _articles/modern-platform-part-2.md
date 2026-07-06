---
layout: article
title: "The Operating Model: Who's Actually Running Your Platform?"
date: 2026-04-21
description: "The Vercel breach shows trust is a liability. The access matrix, shared responsibility model, and enforcement that makes agentic platforms safe."
og_image: ""
featured: false
views: 1192
linkedin: 183
bluesky: 71
read_time: "4 min"
---

*Part 2 of 3 — [Start with Part 1](https://robisit.com/thoughts/modern-platform-part-1/)*

4 min read, what you'll receive: An OAuth token brought down Vercel's internal systems this week. If your team is running AI agents in production, what's written below gives you the structural answer most CTOs don't have yet: a concrete access matrix, a shared responsibility model by layer, and the enforcement mechanism that makes it real.

[subscribe]

## The Setup

Vercel got breached this week. It wasn't a sophisticated exploit that is worthy of recasting Oceans 11. An employee approved an OAuth token from a third-party AI tool and forgot about it.

That token reached a Google Workspace account. That account reached Vercel's internal systems. Environment variables that nobody had explicitly marked as sensitive came out. API keys, database credentials, signing tokens. Someone is now trying to sell the data on BreachForums for $2M. Maybe I was wrong about recasting Oceans 11, I'd watch this movie.

Vercel's advice to customers: rotate your credentials and mark your variables as sensitive going forward.

That's the right advice. It's also advice that only helps if you've been making deliberate structural decisions about access from the beginning. The Vercel breach didn't happen because Vercel's tooling failed. It happened because nobody had made an explicit decision about those particular variables. They lived in a gray zone. Gray zones are where breaches live.

Last week I ended [Part 1](https://robisit.com/thoughts/modern-platform-part-1/) of this 3 part series with: "Most of us don't have a structural answer. We have trust. In an AI-native world, trust is a liability."

Trust is a deferred liability. This week, Vercel found out what trust costs.

---

## Philosophy Before Tooling

Upfront: I don't have a solution, but Vercel's problem is one that I started thinking about well before their issue.

I've built two AI-native platforms from scratch in the last year. Before I touched tooling decisions in either one, I had to settle two things.

**Platform philosophy:** The platform exists to serve agents as first-class operators. Every capability, every API, every credential path has to be evaluated against one question: what happens when an agent uses this instead of a human? Agents don't exercise judgment about what they should do. They do what they can. Design for that.

**Security philosophy:** If it isn't encoded in the token, it isn't permitted. Not in a README. Not in a team convention. Not in a Slack message that says "don't touch prod." If it isn't in the construction of the access layer, the capability doesn't exist.

These two create real tension. Agents need access to be useful. The security model limits access structurally. The resolution isn't broad restriction. It's precision. You don't constrain what an agent is. You scope exactly what it can reach.

---

## The Actor Access Matrix

Three actors. Three scope profiles. This table is the structural answer to "who is responsible when something breaks?"

| Actor | Local | Dev | Staging | Production |
|---|---|---|---|---|
| **Claude Code** (agentic dev) | Full | Full | Read + Limited Write | No access |
| **Ops agent** (always-on automation) | None | None | Read + Targeted Write | Read + Targeted Write |
| **Human** | Full | Full | Full | Full |

The goal of this model isn't to restrict AI. It's to give AI agents enough room to work autonomously without requiring a human to supervise every decision. Agents move fast. The matrix is what makes that speed safe.

Look at the human row. Full access, everywhere, always. That isn't a privilege. It's a design constraint. Full accountability requires full capability. If an agent does something unexpected at 2am, a human needs to get in and fix it without obstacles.

Now look at every other row. No AI actor in this system has full access anywhere. Not because agents can't be trusted in some philosophical sense. Because the system is designed so that trust is never the mechanism. Claude Code cannot reach production. The ops agent cannot touch schema or infra config. Neither can escalate. Neither can try.

That asymmetry is the point. Humans own the risk. The architecture enforces it.

---

## The Shared Responsibility Model

Responsibility in an agentic system cannot be collective. Collective responsibility is how postmortems become finger-pointing exercises. It has to be assigned by layer and by actor.

| Layer | Claude Code | Ops Agent | Human |
|---|---|---|---|
| **Platform** | Validates against it | Monitors it | Designs and owns it |
| **Application** | Writes it | Watches it | Ships it |
| **Environment** | Operates in local/dev/stg | Operates in stg/prd | Operates everywhere |

Platform design is a human decision and stays that way. No agent in my setup determines how compute services are structured, how edge routing is configured, or how the database schema is laid out. Agents work within those decisions. They don't make them.

Application code is increasingly an agent output. Claude Code writes the implementation, runs the tests, and opens the PR. The ops agent watches it in runtime. I review and merge. The agent is the executor. I am the decision gate. That boundary is not blurry.

Environment access is the structural enforcement of everything above. What each actor can reach in each environment is what makes this model real rather than a document someone wrote once and forgot.

---

## STG Is Not PRD

The most common lie in software: "we test in staging."

Most staging environments are production with a different URL. Same credentials. Same access model. The same implicit assumption that it's basically fine. "It works in staging" has become a synonym for "it works," and that conflation is exactly what makes breaches like Vercel's so damaging. When environments share a trust boundary, a compromise in one is a compromise in all of them.

In my setup, staging and production are isolated with different tokens, with different scopes. They run on different infrastructure services with no shared configuration. Claude Code can break things in staging — that's what staging is for. It cannot make those mistakes in production because it cannot reach production.

If the only thing separating your staging and production environments is `NODE_ENV=production`, you don't have two environments. You have one large target.

---

## Doppler Is Not a Secrets Manager

That framing undersells what it does.

Doppler is the enforcement layer for the access matrix. Every actor gets a scoped service token. Every token contains exactly the secrets that actor needs for its environment and its role. Nothing more.

When Claude Code runs in a development context, it gets a token scoped to dev. That token has no production secrets in scope. The agent cannot escalate its way into production because there is nothing to escalate to. The secrets don't exist from its perspective.

When the ops agent runs in production, it gets a narrower token than you'd expect. It can read what it needs to monitor. It can write to a targeted set of endpoints. It cannot access signing keys unrelated to its function. It cannot read database credentials outside its operational scope.

The Vercel breach exposed credentials that nobody had explicitly locked down. In a scoped-token model, that conversation is irrelevant. The question is never "is this variable sensitive?" The question is "does this token have any business seeing this?" If the answer is no, there is nothing to expose. The attacker doesn't hit a policy wall. They find an empty room.

---

## The Structural Answer

Trust is a design choice. It's also a liability you're accumulating invisibly until you're not.

Vercel didn't make an obvious mistake. Their explicitly protected variables held. The breach lived in the gray zone, in the variables that nobody had made a decision about yet.

That's the gap. Not the tooling. Not the platform vendor. The absence of an explicit architecture decision about who can read what, and what requires protection by default.

The actor access matrix is that decision formalized. Scoped Doppler tokens are the implementation. The shared responsibility model is the accountability structure that makes it sustainable as the system grows.

This is not a large undertaking. It requires about two hours of deliberate architecture thinking at the start of a project. What it buys is a system where "what happens when the agent breaks something?" has a structural answer. Not a philosophical one. Not a hopeful one.

A structural one.

---

## Next week, part 3 or 3: Closing the Loop

The operating model tells you who does what and where. The next question is how you know when something goes wrong, and how the system responds without a human in every decision.

Next week, in Part 3: Observability and automated incident response in an agentic system.

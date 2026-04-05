---
layout: article
title: "Stop Building Islands: Designing Software for the Agentic Era"
date: 2026-04-04
description: "The real opportunity of AI isn't shipping faster. It's the rare chance to revisit foundational decisions before the complexity that AI generates makes them permanent."
og_image: ""
featured: true
views: 2841
---

Software is changing. But the real story isn't the code; it’s the shift in the soul of the organizations building it. 

Lately, the conversation around AI in development has been aimed at the wrong target. We are obsessed with velocity: lines committed, tickets closed, sprints compressed. We’ve taken our existing mess and simply asked how to make it pile up faster. 

Shopify CEO Tobi Lütke framed the current tension perfectly: 

> *“Before asking for more headcount and resources, teams must demonstrate why they cannot get what they want done using AI.”*

The instinct is understandable, but the question is misplaced. The real opportunity of this moment isn’t shipping faster. It’s the rare, fleeting chance to revisit our foundational decisions (about data, systems, and team structures) before the complexity that AI generates makes those decisions permanent. Once that complexity compounds, unpicking it becomes a generational debt.

I spent the last few months back in the trenches to make my thinking concrete. I built a production-grade scheduling engine; not as a product, but as a laboratory. Here are three shifts in perspective that emerged when I stopped theorizing and started building.

***

### 1. Relinquish the Illusion of Data Ownership
Engineering teams have a hoarding problem. We build secondary databases for everything: availability, preferences, state. We replicate data that already lives elsewhere because "owning" it feels like control. 

But that control is a trap. It demands synchronization drift, schema migrations, and a lifetime of maintenance contracts. 

I took a different path with this build. There is no application database. **The data authority is the source itself.** I used Google Calendar as the primary store, leveraging the Freebusy API for real-time truth. Cancellation tokens and logic live inside the calendar event’s own extended properties. The application is entirely stateless. 

The result? No migrations. No backup strategy. No admin interface. I didn’t cut corners; I simply refused to own what I didn’t need. For a CTO, the question shouldn't be "How do we store this?" but "Who already owns this truth?" Leverage is found in integration, not replication.

### 2. Design for Interdependence, Not Independence

![Independence vs Interdependance](/images/stop-building-islands-282.png)

We’ve spent decades building "islands": systems that stand alone, stitched together by custom integration code. This worked when humans were the only ones navigating the bridges. It fails when machines take the wheel.

An AI agent doesn’t need a manual; it needs a map. It needs to discover what is possible without a developer hand-holding the integration spec. 

In my proof-of-concept, I implemented a **Model Context Protocol (MCP)** server. This moves us beyond static endpoints and into a world where a system exposes its own operations and context. When an agent connects, it doesn't just see data; it understands capability. 

This changes the growth model of your stack. Traditional integrations scale linearly (you build it, you maintain it). Systems designed for discovery compound. When tools can natively understand each other's "intent," the platform starts to build itself.

### 3. The Unit of Work has Moved Upstream
To close the loop, I extended the project to test these principles on operations. I built an autonomous agent to monitor the production environment. When an issue surfaces, it investigates, generates a fix, and opens a PR for human review. 

What I didn't anticipate was how this radically redefines the role of the engineer. 

Features used to be *built*. Now, they are *briefed*. If a system has clear architectural boundaries and explicit acceptance criteria, the "doing" becomes a commodity. The "thinking" (the high-level design decisions that make autonomous execution trustworthy) becomes the priority. 

This isn't about replacing developers; it’s about elevating them. The organizations that lead the next decade won’t just have the fastest coders. They will have the best architects: leaders who design systems clear enough for an agent to execute and robust enough to run without constant supervision. 

***

### The Constraint is Clarity
These lessons (Data Authority, Interdependence, and Upstream Work) didn’t come from a framework. They came from the constraints of the build. 

The ground is shifting beneath us. The most dangerous thing a CTO can do right now is rely on the playbooks of 2023. The most useful thing we can do is stay empirical, stay curious, and keep building. 

The bottleneck was never speed. It was always clarity.

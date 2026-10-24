---
layout: article
title: "AI Transformation Isn't a Migration: A Framework for Engineering Leaders"
date: 2026-07-06
description: "A framework for engineering leaders navigating AI transformation: seven perspectives adapted from AWS's Cloud Adoption Framework, grounded in DORA, Team Topologies, and Stanford research on AI-assisted development."
og_image: "/images/ai-framework.png"
featured: true
views: 1145
linkedin: 142
bluesky: 31
read_time: "27 min"
---

TL;DR = Two companies buy the same AI tools. One reports transformative gains, the other reports nothing. The difference was never the tools. Drawing on years of leading cloud migrations at every scale, I've built a framework for the thing that actually determines the outcome, the organization itself. 1 AI Transformation framework for you to make your own, 7 perspectives, real numbers, and no pretending your legacy doesn't exist.

---

## AI Adoption ≠ New Tool

It feels like it was yesterday that every board room conversation was talking about how to take advantage of the cloud. But it wasn't. It was a lifetime ago.

Today, I'm seeing engineering organizations treating AI adoption the same way they treated cloud adoption, as a project. Pick the tools, run the pilot, train the teams, declare victory at some percentage of adoption, move on.

I get it. The instinct is understandable. Migrations are something engineering leaders know how to plan, budget, and report on. The process that worked for cloud adoption does not work for AI adoption, and the strongest research we have today says so directly.

Read on to find out why, and for a tangible path to start thinking about why AI adoption is succeeding or struggling at your company.

[contents]

Google Cloud's DORA team ([State of AI-Assisted Software Development report](https://dora.dev/dora-report-2025/)) formed a conclusion that should reframe every AI adoption conversation in a boardroom right now.

AI acts as an amplifier. It does not fix an engineering organization.

It magnifies whatever that organization already is.

Teams with strong platforms, clear ownership, and disciplined delivery practices get meaningfully faster and better. Teams with fragmented systems, ambiguous domain boundaries, and weak feedback loops also get faster, at producing fragmentation and ambiguity. 

The bottleneck was never the number of code commits and a tool that increases typing speed does not remove it.

This is why "buy the latest tool and wait for productivity" fails so consistently, and why the gap between organizations reporting transformative gains and organizations reporting nothing is so wide. The tools are largely the same. The organizations are not.

So, I have a simple thesis. **AI transformation is an organizational systems problem, not a tooling rollout.**

What follows is a framework for working that problem, aimed at leaders of established software companies with real customers, real revenue, and real legacy.

The framework I describe isn't a polished guide. Instead, it's an overview based on my experience leading large scale transformations at AWS, and transforming engineering organizations outside of AWS.

[subscribe]

---

## Get In To The Right Mindset

### A running example, on purpose

To keep this honest, I will carry one company through the entire framework. Call it Meridian, fictional but deliberately shaped like the companies this framework is for.

Meridian has been in business for over twenty years selling software to service businesses. Scheduling, client management, billing, the operational backbone of appointment-driven companies. Its customer base is split. A newer SaaS product serves a growing share of customers, and a Windows desktop application, first shipped when .NET was young, still runs the daily operations of a large and loyal segment who have no intention of leaving it.

That shape is deliberate. Almost every piece of AI transformation content assumes a greenfield app, or ignores twenty years of working software. Meridian does not get that luxury, and neither do you.

Any framework that only works for a company founded eighteen months ago is not a framework, it is a demo.

One more piece of framing. What follows is Phase 1, the foundation an organization needs before AI leverage compounds instead of dissipating. It is not a finished checklist you complete and file away. I will come back to why at the end.

### The shape of the framework

Structurally, I am borrowing from something that worked. AWS's [Cloud Adoption Framework (CAF)](https://aws.amazon.com/cloud-adoption-framework/) and its [Migration Readiness Assessment (MRA)](https://docs.aws.amazon.com/prescriptive-guidance/latest/migration-readiness/welcome.html) organized cloud transformation not as a linear task list but as a small number of named perspectives, lenses through which a leader could assess their own organization's readiness.

That structure succeeded because it met organizations where they were, and because it made honest self-assessment the first deliverable instead of the thing everyone skipped.

This framework, which I call **the AI-Native Engineering Framework**, adapts that shape for a different transformation. The content here is not AWS's, and this is not a repackaging of the CAF. It is an adaptation of a structural idea that earned its keep.  Diagnosis, not prescription is what works.

Phase 1 consists of **Seven Perspectives**. For each, I will cover what it is, why it matters based on what research and experience shows, what acting on it looks like, and the questions to ask your own organization. This is a diagnostic and planning lens, meant to be adapted, not followed like a runbook.

---

## 7 Perspectives to Adopt AI

![](/images/ai-framework.png)

### Perspective 1: Business

Start where the business is, not where the technology is.

The first concrete work in an AI transformation should contain no AI at all. It is a current-state architecture review, done honestly, paired with direct conversations with customers about what they actually need, in their own terms, from the product they pay for today, not what they might do with AI features.

This ordering matters because the amplifier cuts both ways. AI magnifies your organization's direction too. An engineering org pointed at technically interesting problems instead of customer problems will now build the wrong things faster, with better commit messages.

In practice, this perspective produces 3 artifacts, and it should be timeboxed in **weeks**, not quarters. 

1. A current-state architecture map that is accurate rather than aspirational, including the parts everyone is embarrassed about. 

2. A written inventory of where the same business concept lives in more than one place, which becomes the work queue for the Architecture perspective.

3. A set of transformation goals where each one traces to a customer problem someone actually voiced, with the customer's framing preserved. If a goal cannot be traced that way, it goes in a parking lot, not the plan. And if your goals were written before any of this work happened, treat them as drafts.

At Meridian, this effort doesn't look glamorous, and it has probably been done before. It means mapping what actually exists across the SaaS product and the desktop product, where the two share concepts, where they diverge, where twenty years of tactical decisions have left duplicated logic. And it means sitting with customers on both sides of that split. The desktop customers, in particular, will tell you things a roadmap workshop never will, starting with why they have not migrated.

Some real questions to ask your organization. Can anyone produce an accurate current-state architecture diagram without starting a project to make one? When did an executive last hear a customer describe their needs firsthand? Do we have clear product use diagrams showing what our customers value and what they don't? Are our current AI goals traceable to a customer problem, or to a capability we found exciting?

### Perspective 2: Leadership

The second perspective is executive alignment, and it starts with an uncomfortable admission, which is that your leadership team does not currently agree on what "AI" means for your organization, and no external standard exists (yet) to define it for you.

This is not a criticism. The ground genuinely is not settled, and any vendor telling you there is an established standard for what "AI-native" means is selling you their definition. What your organization needs is a working definition, written down, specific to your business. Make it a one-page document the leadership team actually signs, covering what you mean by an agent, what you mean by AI-assisted development, which systems and workflows are in scope, which are explicitly out, and a standing commitment to revisit the document quarterly because it will be wrong in six months. The signature matters more than the prose. It converts six private definitions into one shared, revisable one.

The deeper leadership work is harder. Roughy 30 years of software delivery assumptions are being reset. How long things take, what a team of a given size can ship, whether estimation works at all. Every experienced leader carries an internal model built from decades of pattern matching, and that model is now wrong in nonuniform ways. Some work got radically cheaper, some barely moved. The instinct to reason from precedent, normally a leadership strength, becomes a liability when the precedents quietly expired.

There is a practical exercise here, and I recommend actually running it. Take three or four recently completed projects and re-estimate them as if they were starting today with target capability, independently, then compare. The spread in the answers is a direct measurement of how uncalibrated the team's intuitions are, and the conversation it forces is the real deliverable.

Not all of these resets favor how things used to be done, and some prople will be personally uncomfortable for leaders whose credibility rests on the old intuitions.

This mindset shift cannot be delegated to a tools budget. A leadership team that funds AI adoption while privately planning and estimating like it is 2019 has not started a transformation. 

I cant tell you how many transformaotions I've seen fail because they're a single line item on the P&L.

Questions worth asking: Does our leadership team share a written working definition of what AI means here? Which of our planning and estimation assumptions have we actually re-examined, versus carried forward on inertia? Where has a leader visibly updated a long-held position based on what AI changed?

### Perspective 3: Architecture

The architecture perspective is expressed three ways.

**1. AI-ready documentation** comes first. Documentation has always been aspirational in most organizations, and it survived because its consumers were humans who could fill gaps by asking someone. An agent cannot tap a shoulder. Documentation that is structured, current, and accurate enough for an agent to act on reliably is a different artifact from documentation that is "pretty good for onboarding." It is closer to an interface than a wiki, and it should be treated like one, versioned alongside the code it describes, updated in the same change that alters behavior, and owned by the team that owns the system. If your docs are eighteen months stale, an agent will confidently build against the system you used to have.

Off-topic side note: What I descrive above is the reason why people are (correctly) excited about Obsidian vs systems like Confluence. But I digress, back to the 3 expressions of the architecutr perspecive.

**2. A unified domain model** is the second expression, and I would argue the highest-leverage architectural investment on this list. Every business concept should exist exactly once. "Appointment" means exactly one thing everywhere in Meridian's systems, whether it is being touched by the SaaS scheduling flow, a reporting job, or the desktop client's sync layer. Same for "guest", same for "therapist", same for every noun the business runs on.

Here is why unified data models suddenly matter more than they did...

Ambiguous and duplicated domain boundaries were always a cost, but they were a survivable cost, because humans negotiated the ambiguity through conversation.

Recent [Team Topologies](https://teamtopologies.com/) research on AI-era organization design identifies exactly this dynamic as a new failure mode. AI agents take ambiguity at face value. An agent handed two subtly different "appointment" concepts does not schedule a meeting to reconcile them. It picks one, or blends them, and generates plausible code that violates a domain boundary nobody ever wrote down.

[Conway's Law](https://martinfowler.com/bliki/ConwaysLaw.html) did not go anywhere. It got a faster execution engine.

**3. API as the single source of truth** is the third expression. Every consumer of the system, without exception, goes through the contract. AI agents, the mobile app, partner integrations, internal tools, reporting. No side channels. No "just this once" direct database access, because an agent that learns the side channel will use the side channel, at scale, forever. The API is where the unified domain model becomes enforceable rather than aspirational, and it is the boundary at which you can observe, version, and govern everything that touches your system. It is also the honest answer to Meridian's desktop question. The legacy client's path forward is not a rewrite, it is progressively re-plumbing it to consume the same contract as everything else.

A few questions for your organization: Could an agent, given only our documentation, correctly modify a core workflow? How many definitions of our top five business concepts exist in code today? What consumers currently bypass our API, and why have we allowed each one?

### Perspective 4: Governance

The organizing principle for AI governance is **bounded agency**. Scope an AI agent the way you would scope a human's access. Explicitly. Narrowly. Auditably.

Matthew Skelton put a name to this at [QCon London in 2026](https://qconlondon.com/presentation/mar2026/team-topologies-infrastructure-agency-ai), and it is the right name, because it reframes the question. The question is not "how much can we trust the model". It is "what is this actor permitted to do, and how would we know what it did". You would never grant a new contractor standing write access to production, every repository, and the billing system because narrower provisioning was inconvenient. Yet that is precisely how many organizations deploy agents today, because broad access makes the demo work faster.

The industry has already named the failure mode. OWASP's LLM risk taxonomy includes [Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) as a category in its own right, meaning systems granted more capability, autonomy, or permissions than their function requires. You need to translate "scoped like a human" into the same access dimensions you already use for people, because they all apply.

**Environment scope** means an agent's credentials are bound to specific environments. An agent that works in development and staging holds no production credentials at all, not production credentials it promises not to use. **Task scope** means permissions match function, per agent, with no shared "AI service account" underneath everything. An agent that drafts code changes gets repository read, branch write, and pull-request creation. It does not get merge rights. Instead, the pipeline and a human owner control the merge. **Time scope** means credentials are short-lived, scoped to the task or session rather than standing. This quietly inverts your security posture, because revocation stops being an emergency procedure and becomes the resting state of the system. And then there is **identity**. Every agent operates under its own distinct identity in your logs. The moment agents share credentials with each other or with humans, your audit trail is fiction, and you will discover that during an incident, the most expensive time to discover anything.

Meridian's first agent deployment shows what this looks like on the ground. An agent that drafts fixes for the SaaS product holds read access to the SaaS repositories only, write access to branches, and the ability to open pull requests. Its credentials are staging-scoped and expire with the task. It has no access to the desktop codebase, no access to production, and the tables holding payment data are outside its scope entirely, not because the agent is untrusted in some vague sense, but because its function does not require them. That sentence, "its function does not require them," is the entire governance model in miniature.

The second half of governance is accountability, and it should be boring. **Someone owns every agent-generated change**, the same way someone owns every human-authored one. In practice, every change lands with a named human owner, either the engineer who reviewed and approved it or, for changes flowing through automated approval, the named owner of the pipeline that made the call. That pipeline-owner role is not symbolic. When an agent-generated change causes an incident, the response runs exactly like any other incident. The owner is on point, the retrospective is blameless, and the questions asked are the useful ones. Was the agent's scope right? Did the pipeline gate what it should have gated? Was the approval path appropriate for this class of change? What you are trying to prevent is "the agent did it" becoming an acceptable answer to "who owns this change," because that answer means nobody owns the fix, and a system where nobody owns the fix will generate the same incident again. Lose that, and you have lost the audit trail and, shortly after, the plot.

Questions to ask here: Can we enumerate every agent operating in our systems and exactly what each is permitted to do? If an agent-generated change caused an incident tonight, is the owner unambiguous? Is any agent holding access it was given for convenience rather than function?

### Perspective 5: Operations

The operations perspective is the least novel item in this framework, and I want to be direct about that rather than dress it up. Robust, secure CI/CD, with unit tests, integration tests, and API-level tests as non-negotiable gates.

You have heard this advice for 15+ years. What changed is not the advice. What changed is that it became load-bearing.

When humans authored every change, weak test coverage was a survivable risk, because human throughput was the natural rate limiter and human judgment was an informal gate on every commit. Agentic development removes the rate limiter. The volume and velocity of change goes up, the average scrutiny per change goes down, and the pipeline becomes the only gate that reliably scales with the new throughput. A test suite that was a nice-to-have at ten deploys a week is the entire safety system at a hundred.

So what does elite actually look like now? Three things change structurally, not just in emphasis.

First, human review moves up a level. Line-by-line inspection of every change does not scale to agentic volume, and pretending it does means review becomes rubber-stamping with extra steps. The pipeline owns line-level correctness through tests, static analysis, and contract checks. Humans spend their review budget where judgment actually lives, on whether the change does the right thing, whether it is tested in proportion to its blast radius, and whether it touches a contract, a domain boundary, or a data model. A one-line change to a billing rule deserves more human attention than three hundred generated lines of well-tested CRUD, and your review norms need to say so explicitly.

Second, the definition of "good enough coverage" changes. The percentage number was always a weak proxy, and it is now nearly useless, because agents produce plausible code, and plausible-but-subtly-wrong is the characteristic failure mode. The standard that matters is whether the suite would catch a change that looks correct, compiles, and is wrong about a business rule. API-level contract tests become the highest-value layer in the suite, because they defend exactly the boundary that Perspective 3 declared the source of truth, and they are indifferent to how the code behind the contract was produced.

Third, pipeline speed becomes a feature, not a nicety. If the safety net takes forty-five minutes, agents queue behind it, humans route around it, and you have rebuilt the bottleneck you paid to remove, minus the safety. Elite here means the pipeline is treated as a product with a named owner, a latency budget, and its own roadmap, and it means there are no manual deployment paths left standing beside it, because any path that bypasses the gates is the path everything bad will eventually take.

This is also where Meridian meets its first genuinely hard conversation. The desktop codebase almost certainly cannot be tested or deployed with anything like the SaaS product's rigor. That asymmetry is real, and it should shape sequencing rather than be wished away. I will come back to it.

Three questions to sit with. Would we be comfortable tripling deploy volume tomorrow with our current gates? Which of our test suites would we actually trust to catch a plausible-looking, subtly wrong change? Where does human review currently substitute for automation that should exist?

### Perspective 6: People

Two things are true about the people side of this transformation, and they pull in different directions, which is why leaders keep mishandling it.

The first is that team shape is genuinely changing. A meaningful fraction of what dedicated DevOps, SRE, and DevEx roles historically did was coordination. Translating between teams, managing handoffs, holding operational context that the platform could not hold itself. As platform capabilities absorb that coordination overhead, the boundaries between those roles blur, and work that once required a handoff between three specialists increasingly flows through one person operating a capable platform. The Team Topologies research points the same direction, with stream-aligned teams getting smaller and enabling teams pivoting from teaching delivery practices to accelerating AI adoption. Pretending role boundaries will hold their current shape is not loyalty to your people. It is a failure to prepare them.

The second truth is about what preparation actually means, and this is where I want to be precise, because there is a version of this argument circulating that I think is both wrong and corrosive. The wrong version says AI will sort engineers into the passionate, who survive, and the rest, who deserve what they get. That framing is gatekeeping wearing a strategy costume, and it conveniently relieves leadership of any responsibility.

The accurate version is narrower and more useful. **Continuous learning has become a core professional skill**, in the same category as writing tests or understanding version control. It is a practice, not a personality trait, and like every professional practice, it is trainable and it is the organization's job to build infrastructure for it.

Here is what that infrastructure looks like when it is real rather than rhetorical. Learning time is a scheduled, recurring block, on the order of five to ten percent of engineering time, a half day weekly or a full day per sprint. The right fraction will vary with organization size and maturity, so treat the number as a starting calibration rather than a benchmark. What does not vary is that the time is excluded from sprint capacity math, and that exclusion is the entire mechanism. If learning time lives inside sprint capacity, sprint pressure will eat it, every time, and no amount of leadership encouragement will save it, because the incentives are pointed at the deliverable. The test of whether your organization actually has learning time is not the policy document, it is whether an engineer using it feels the need to apologize.

It also looks structurally different from training-as-checkbox. The output of checkbox training is a certificate. The output of real learning infrastructure is shared knowledge. A recurring internal forum where engineers demo what they tried, including what failed, does more for organizational capability than any compliance-tracked curriculum, because it turns individual exploration into collective calibration. Round it out with the informal channels. Open-source participation treated as capability investment rather than a perk, structured exploration time for evaluating new capabilities against real problems, and learning goals that show up in performance conversations as investment in the engineer, not compliance by the engineer.

The organizations that get this right will not be the ones that hired mythical AI-native engineers. They will be the ones that turned learning into a system, so the engineers they already have, who already carry the institutional knowledge, keep pace with a moving field.

The questions to ask: Does our org chart reflect where coordination work actually lives today, or where it lived in 2020? What learning happens here on company time, structurally, not heroically? If an engineer wanted to spend four hours exploring a new capability this week, what would they have to apologize for?

### Perspective 7: Platform

The seventh perspective is where the previous four stop being separate initiatives and become one thing, an internal AI engineering platform. This is the payoff, and I mean that word. Not a someday-maybe. The payoff.

Let me make it concrete with Meridian. A product request comes in. Resources need recurring blackout dates. A doctor wants every second Friday off, indefinitely, and the scheduling system needs to respect it.

In most organizations, the first week of that request is archaeology. Someone figures out which tables hold availability, which services enforce booking rules, which of the three appointment-adjacent concepts this touches, which APIs and clients are affected, and who to ask about the parts nobody remembers. The work has not started - the finding-out has.

Now run the same request through an organization that did the work of Perspectives 3 through 6. The domain model is unified, so "therapist," "appointment," and "availability" each exist exactly once, and the platform can identify every affected business rule mechanically. The API is the single source of truth, so the affected surface is enumerable, not discoverable. The documentation is AI-ready, so an agent can consume the current business rules directly. Governance means the agent drafting the change is scoped and its output is owned. Operations means the pipeline can actually catch its mistakes. The platform knows the affected tables, rules, and contracts before a human has gone looking. The archaeology week disappears, and it disappears on every request from now on. That is what compounding leverage looks like at ground level.

This is also where current research is most emphatic. The Team Topologies work on AI-era organization design identifies platform teams as becoming the center of gravity of engineering organizations, arguably the highest-leverage investment available, rather than the supporting function they were often treated as. The mechanism is simple. AI agents need a consistent, standardized foundation to operate effectively, and every deviation from the standard requires custom context, which degrades output quality. Humans absorb organizational inconsistency with judgment and hallway conversations. Agents pay for it in accuracy, on every single task. The platform is where you buy that consistency once instead of paying for its absence continuously.

One practical note on scope, because "internal AI engineering platform" invites empire-building. Do not start by designing the platform. Start by picking one high-traffic workflow and making it fully legible end to end, with unified concepts, a contract-first API, agent-consumable documentation, scoped agent access, and a gated pipeline. The platform is what you extract from the second and third workflow, once the pattern is proven, not what you architect in advance of any of them.

And the questions. If a routine product request arrived today, how much of the first week would be spent finding out rather than building? What percentage of our systems could an agent operate on without bespoke context? Is our platform team funded like a center of gravity or staffed like a cost center?

---

## A Practical Example of the Framework

### Applying the framework at Meridian

Frameworks earn their keep in contact with a real portfolio, so let us put this one in contact with Meridian's, starting with the fact everyone would rather skip, which is that the gains will not be evenly distributed.

[Stanford's software engineering productivity research](https://softwareengineeringproductivity.stanford.edu/), cited in DORA's [2026 ROI of AI-Assisted Software Development report](https://cloud.google.com/resources/content/dora-roi-of-ai-assisted-software-development), quantifies the unevenness. AI assistance yields roughly 35 to 40 percent productivity gains on simple, greenfield work, and often 10 percent or less on complex legacy code. For a company like Meridian, straddling a modern SaaS surface and a twenty-year-old Windows codebase, that is not a footnote. It is the shape of the entire investment decision. Leadership teams that set one uniform productivity expectation across that portfolio are setting themselves up to declare failure in the exact place the research predicted modest results.

The honest sequencing follows directly. Invest first in the SaaS surface, where the domain model and APIs are tractable to unify and where the 35 to 40 percent gains are actually available. Let the early, visible wins there fund the patience the legacy side requires. For the Windows codebase, resist the rebuild fantasy and work incrementally. The [strangler fig pattern](https://martinfowler.com/bliki/StranglerFigApplication.html), replacing capabilities piece by piece behind stable interfaces while the legacy system keeps running, remains the most reliable modernization approach we have, and the API-as-source-of-truth stance from Perspective 3 is precisely what makes it possible. Each strangled slice becomes newly legible territory where AI leverage starts working. The desktop product is not excluded from the transformation. It is on a different curve, and pretending otherwise burns credibility you will need later.

Which brings up measurement, and a warning. DORA's ROI research describes a J-curve, an initial productivity dip as teams absorb new tools, new practices, and new failure modes, before the gains materialize. That dip is tuition, not evidence of failure, but only if leadership named it in advance. A transformation measured quarterly against a straight-line improvement assumption will be cancelled at the bottom of the J, which is the most expensive possible moment to quit.

And this framework should never be pitched as a headcount reduction initiative. This is not sentiment. It is DORA's explicit finding. The strongest organizations in the research reinvest reclaimed capacity into the backlog, into quality, into the platform itself, rather than cutting staff, and retaining and training existing engineers preserves institutional knowledge that is expensive to lose and slow to rebuild. Frame the ROI as unlocked capacity. The archaeology weeks recovered, the backlog items that finally ship, the platform investment that compounds. An organization that frames AI as payroll reduction will watch its best people, the ones with options, act accordingly, and it will have poisoned the continuous-learning culture that Perspective 6 depends on. You cannot ask people to enthusiastically build the thing you have told them is their replacement.

---

## Measure it and Make it Real

### Beyond Phase 1: the perspectives still emerging

I said at the start that this is Phase 1. Here is what that means, briefly.

The Seven Perspectives are the foundation, the organizational conditions under which AI leverage compounds. They are not the whole transformation, because the whole transformation does not fully exist yet. As organizations mature past the foundation, new perspectives are already becoming visible at the edges. AI in presales and customer support is an obvious near-term candidate, where the same unified domain model and API contract that serve engineering agents can serve customer-facing ones. AI-native QA, or autonomous incident response, may well be another, as the operations perspective evolves from gating agent output to actively deploying agents in defense of the system.

I am deliberately not specifying these, because I would be guessing, and the guesses would age badly. The point of naming them at all is the meta-point, that this list will keep growing. A framework for a transformation that is still being defined has to be a living document, and treating this one as finished would repeat the exact mistake it was written to correct.

### If you take one thing from this...

If you take one thing from this neccisarily long text, take the amplifier. AI will make your organization more of what it already is, which means the highest-return AI investment available to you is the patient, unfashionable work of becoming an organization worth amplifying.

Treat this framework the way the best organizations treated the Cloud Adoption Framework it borrows its shape from. 

Thousands of companies adapted that structure to businesses that looked nothing like the reference architecture, and the adaptation was the point. Reshape these perspectives to fit your organization. The transformation itself is not optional, but the map is yours to redraw, and it will never have a final shape.


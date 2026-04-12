# The Modern Infrastructure Stack for AI-Native Development

AWS has 200+ services. Your AI agent doesn't care. The complexity you've normalized over a decade is now a tax, paid every time an agent stalls or waits on a pipeline you built for humans. The teams moving fastest right now aren't on GCP or Azure. They're on stacks you've probably never evaluated seriously.

CSPs weren't designed for non-human operators. That's the problem this post is about.

---

## Ephemeral Environments Beyond the Container

The traditional answer to ephemeral environments is Docker. Or Terraform. Or a combination of both with a YAML file nobody fully understands six months later. That model works until you're running AI-assisted development at any real cadence.

The problem isn't containers. It's the assumption underneath them: that an environment is an infrastructure artifact. Something you provision, configure, and tear down. That made sense when humans were the operators. It breaks when agents are generating ten parallel workstreams before lunch.

The platform isn't a static artifact you maintain. It's a composition you can change. A specific application needs a Vercel feature that Render doesn't offer, so you swap it. One component moves. The rest of the platform doesn't notice.

That only works if every component was chosen to be replaceable. Loosely coupled decisions aren't a best practice. They're the prerequisite.

---

## The Stack

This is what I run on. Every decision was made for one reason: it had to work for a non-human operator as well as a human one.

| Service | Job | Why it beat the CSP equivalent |
|---|---|---|
| **Render** | Compute and preview environments | Spins up isolated environments per branch without a provisioning ticket or a Terraform plan |
| **Cloudflare** | Edge, DNS, Zero Trust, object storage | Replaces four separate AWS products with a single control plane that's actually navigable |
| **Supabase** | Postgres with branching | Each workstream gets its own isolated data layer |
| **Clerk** | Auth | Handles the full identity surface so agents never touch credential logic |
| **Resend** | Transactional email | One API, no SMTP configuration, no SES policy debugging |
| **Stripe** | Payments | The CSP alternative doesn't exist. Stripe owns this category |
| **PostHog** | Product analytics | Self-hostable, open source, no data engineering team required |
| **Sentry** | Error monitoring | Surfaces what broke and where without manual instrumentation overhead |
| **Upstash** | Serverless Redis | Pay per request, zero idle cost. The only sensible model for workloads that aren't running 24/7 |
| **Doppler** | Secrets management | Scoped service tokens mean agents only access what they need. This is the one you don't skip |

---

The stack is the easy part. Pick the right tools, keep them loosely coupled, and you have a platform that can move. But a platform agents can operate raises a question most CTOs haven't answered yet.

When an agent breaks production, and it will, who is responsible? Not philosophically. Operationally. Who has access to what, and why? How is that boundary enforced structurally, not just by convention?

Most teams don't have an answer. They have trust.

That's what Part 2 is about.

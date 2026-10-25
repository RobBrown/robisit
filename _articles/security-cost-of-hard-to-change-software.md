---
layout: article
unlisted: true
title: "The Growing Security Cost of Software That's Hard to Change"
date: 2026-10-25
description: "AI is making vulnerabilities easier to exploit. The ability to update, isolate, and recover enterprise systems is becoming a critical security capability."
og_image: ""
featured: false
views: 0
read_time: "7 min"
cards:
  situation:
    prompt: "Which of these is closest to your situation?"
    options:
      - id: security
        label: "We're struggling to keep up with vulnerabilities."
        order: [risk, remediation, exposure, isolation, ai, legacy, investment]
        anchor: "#old-security-decisions-deserve-another-look"
      - id: architecture
        label: "Our systems are difficult to change safely."
        order: [remediation, isolation, legacy, exposure, investment, risk, ai]
        anchor: "#finding-a-vulnerability-is-not-the-same-as-fixing-it"
      - id: modernization
        label: "We're struggling to justify replacing legacy systems."
        order: [legacy, investment, isolation, remediation, risk, exposure, ai]
        anchor: "#the-hidden-security-cost-of-legacy-technology"
  default_order: [risk, remediation, legacy, exposure, isolation, ai, investment]
  default_anchor: "#old-security-decisions-deserve-another-look"
  insights:
    - id: risk
      title: "Nothing changed but the odds."
      body: |
        A vulnerability considered too difficult to exploit two years ago
        can become a practical attack today. AI is reducing the effort
        required to investigate weaknesses and develop exploits. The
        software stays the same. The risk does not. Every accepted
        vulnerability rests on assumptions about what attackers can do.
        Those assumptions need to be revisited as their capabilities
        improve.

    - id: remediation
      title: "Finding vulnerabilities is getting easier. Fixing them isn't."
      body: |
        Verizon found that organizations fully remediated only 26% of
        known exploited vulnerabilities in 2025. Median remediation
        time reached 43 days. AI accelerates discovery, but production
        changes still require testing, coordination, and deployment.
        A vulnerability discovered in hours can remain exposed for weeks.
        The constraint is no longer just knowing what is wrong. It is
        being able to change the system safely.

    - id: legacy
      title: "Legacy systems can become expensive overnight"
      body: |
        A fifteen-year-old system can look economical until a critical
        vulnerability appears in a dependency it cannot easily update.
        Suddenly, the choices are continued exposure, restricted service,
        or emergency modernization. The technical debt was already there.
        The financial consequences arrived without warning. Modernization
        business cases need to account for the cost of systems that
        cannot be patched, isolated, or replaced quickly.

    - id: exposure
      title: "The price of finding security exploits fell."
      body: |
        The PHP vulnerabilities disclosed in October 2026 illustrate
        the shift. An underlying weakness reportedly known since 2020
        became part of a practical exploit chain developed with
        AI-assisted research. The code had not suddenly become vulnerable.
        The ability to exploit it had changed. Organizations can no
        longer assume that yesterday's difficulty will protect
        tomorrow's systems.

    - id: isolation
      title: "Architecture determines the consequences of a successful attack"
      body: |
        Two organizations can run the same vulnerable software and face
        very different consequences. One isolates the affected service,
        limits its permissions, and deploys a fix independently. The
        other depends on tightly coupled applications and shared
        infrastructure. The vulnerability is identical. The exposure
        and recovery options are not. Isolation, deployment independence,
        and recoverability are security capabilities established long
        before an attack begins.

    - id: ai
      title: "AI helps defenders most when their systems can change"
      body: |
        AI can identify defects, propose corrections, and improve
        testing. It cannot automatically eliminate undocumented
        dependencies or make a tightly coupled application safe to
        update. Organizations with strong testing, deployment, and
        recovery practices can turn AI-assisted fixes into production
        changes faster. Those without them risk discovering problems
        faster than they can resolve them.

    - id: investment
      title: "Architecture investment is becoming security investment"
      body: |
        Security budgets address immediate threats. Modernization
        budgets compete on efficiency and long-term business value.
        That separation misses an important cost. A system that can
        be updated in hours instead of weeks reduces the time it
        remains exposed. A service that can be isolated limits the
        consequences of compromise. The ability to change and recover
        safely belongs in the security investment discussion.

  terminal:
    knows: "Cybersecurity increasingly depends on whether enterprise systems can be changed, isolated, and recovered as quickly as threats evolve."
    resolves: "The article connects the October 2026 PHP vulnerabilities, Verizon's 43-day median remediation time, and the financial exposure of legacy systems. It explains why old risk decisions need reassessment and why architecture investment deserves a place in security planning."
---

AI is changing cybersecurity faster than most organizations can adapt.

Attackers are using AI to automate reconnaissance, investigate vulnerabilities, and develop exploits. Security researchers are using the same technology to uncover weaknesses that might otherwise have remained hidden for years.

On October 21, PHP shipped emergency patches for two critical vulnerabilities after details leaked ahead of their planned disclosure. Attackers were already probing exposed systems before the fixes became available.

The PHP incident is particularly revealing. The underlying weakness had reportedly been known since 2020, but AI-assisted research helped demonstrate a practical exploit chain.

The software hadn't suddenly become vulnerable. What changed was the ability to exploit it.

We're still in the early stages of this shift. As AI improves, the effort required to find and exploit vulnerabilities could fall considerably. Threats may arrive faster than organizations can reasonably respond.

This has three important consequences for technology leaders.

First, security decisions made years ago may no longer be valid. Vulnerabilities previously considered too difficult to exploit deserve another look.

Second, the ability to change software safely is becoming a critical security capability. Finding vulnerabilities faster accomplishes little if updating production systems takes weeks.

Third, the financial risk of legacy technology is growing. A system that has operated reliably for fifteen years can suddenly become an expensive liability when a critical vulnerability cannot be fixed without major disruption.

These aren't simply problems for security teams. They are architectural and investment decisions that determine how effectively an organization can respond when something goes wrong.

## Old security decisions deserve another look

Every mature technology organization has a backlog of security findings that haven't been fixed.

Some are considered low risk. Others have compensating controls. Some were accepted because exploiting them seemed impractical.

Those decisions aren't necessarily wrong. Organizations have limited engineering capacity, and not every vulnerability deserves immediate attention.

But risk acceptance depends on the information available when the decision is made.

AI is changing that information.

Researchers can use AI to investigate vulnerabilities, explore potential attack paths, and develop exploits that previously required substantial specialist effort.

Google's Threat Intelligence Group reported that monthly vulnerability disclosures roughly doubled between January and August 2026, from 5,045 to 10,740. AI isn't responsible for that entire increase, and attribution remains difficult. But its growing role in vulnerability research is clear.

A vulnerability that was difficult to exploit two years ago may be considerably easier to exploit today. Nothing about the affected system needs to change for the organization's exposure to increase.

This creates a problem for traditional risk management. We regularly reassess systems when their configurations change, but we rarely revisit accepted vulnerabilities when the capabilities of potential attackers improve.

An old security assessment shouldn't remain valid indefinitely simply because the software hasn't changed.

## Finding a vulnerability is not the same as fixing it

AI may help organizations discover vulnerabilities faster. That doesn't mean they can fix them at the same pace.

Verizon's 2026 Data Breach Investigations Report found that organizations fully remediated only 26% of the vulnerabilities in CISA's Known Exploited Vulnerabilities catalog in 2025. The median time to full remediation increased from 32 to 43 days.

Meanwhile, attackers can begin exploiting some critical vulnerabilities within days of disclosure.

The obvious response is to patch faster. That's important, but it overlooks why patching takes so long.

Consider two organizations running the same vulnerable software.

In the first, the affected service can be updated independently. Automated tests provide reasonable confidence that the change won't break other functionality. The team can deploy a fix, monitor the result, and roll back if necessary.

In the second, the same software sits inside a tightly coupled enterprise platform. Updating it requires coordination across several applications, infrastructure teams, vendors, and business owners. Testing takes days because nobody can confidently predict what else might break.

Both organizations know about the vulnerability.

Only one can respond quickly.

This is where enterprise architecture becomes a security issue.

The ability to deploy independently, isolate services, limit access to sensitive systems, and recover from failed changes directly affects how long an organization remains exposed.

It also changes what happens if an attacker succeeds.

A compromised application with narrowly scoped permissions and limited network access presents a very different problem from one that can reach customer records, internal services, and shared infrastructure.

These decisions were made long before the vulnerability was discovered.

For years, we've justified architectural improvements through engineering productivity, reliability, and operating costs. Those benefits remain important. But the ability to make changes safely, without disrupting the business, is increasingly a cybersecurity capability in its own right.

## The hidden security cost of legacy technology

This matters most for older enterprise systems.

The PHP vulnerabilities illustrate the problem. Official fixes targeted supported versions, while organizations running older releases faced more complicated options, including vendor backports, additional isolation, or upgrading.

For some organizations, applying a patch is routine maintenance.

For others, it becomes a substantial modernization project.

A system might have been running reliably for fifteen years. Its operating costs are predictable. The business understands its limitations, and replacing it has never seemed urgent enough to justify the investment.

Then a critical vulnerability appears in a dependency the system cannot easily update.

Suddenly, the organization faces an uncomfortable choice: continue operating with known exposure, restrict or disable important functionality, or attempt a major technology change under considerable time pressure.

The underlying technical debt hasn't changed. Its financial consequences have.

Modernization business cases need to reflect this more clearly.

We commonly calculate the cost of maintaining older systems, the engineering effort they consume, and the productivity improvements a replacement might deliver.

We rarely calculate what happens when one of those systems becomes unsafe to operate and cannot be fixed quickly.

What would it cost to take the application offline for three days? What if replacing a vulnerable dependency required six weeks of engineering work? How much revenue depends on a service that cannot be isolated without affecting other business processes?

Those aren't hypothetical categories of cost. They're consequences of architectural decisions.

And unlike the gradual expense of maintaining legacy technology, they can arrive with very little warning.

## AI will help defenders, too

There's an important counterargument.

AI isn't benefiting only attackers. Security researchers and software engineers are using it to identify vulnerabilities, develop fixes, and improve testing.

Google's Chrome team, for example, has reported substantial increases in security fixes supported by AI-assisted research and engineering. It has also been improving its release processes and investing in memory-safe software.

That's encouraging. Better defensive tools could significantly reduce remediation times.

We should also be careful not to confuse more vulnerability disclosures with more successful attacks. Research published this year suggests that only a small proportion of disclosed vulnerabilities are being exploited, and evidence of a broad AI-driven exploitation surge remains limited.

But that doesn't undermine the architectural argument.

AI can help engineers identify a defect and propose a correction. It cannot automatically make an old application independently deployable, eliminate undocumented dependencies, or guarantee that a production change won't disrupt critical business processes.

Organizations with strong testing, deployment, and recovery capabilities are better positioned to benefit from AI-assisted remediation.

Those without them may simply discover their problems faster.

## A different conversation about security investment

Most executive security discussions include familiar measures: critical vulnerabilities outstanding, patching deadlines, remediation performance, and security investment.

We should continue measuring them.

But I would add three questions to the conversation.

Which of our critical business systems cannot be isolated quickly if compromised?

Which applications would take weeks to update or replace if a serious vulnerability emerged tomorrow?

How many security risks have we accepted based on assumptions about exploitability that we haven't revisited in years?

The answers tell us something a vulnerability dashboard cannot.

They reveal how much control we actually have when something goes wrong.

This matters because architecture and cybersecurity investments are often evaluated separately. Security receives funding to address immediate threats, while modernization competes for budgets based on longer-term efficiency and business value.

That separation is becoming harder to justify.

A platform that can be updated safely in hours rather than weeks has security value. So does a system that can be isolated without interrupting the business, or restored quickly after a compromise.

AI may continue making vulnerabilities easier to discover and exploit. It may also make fixing them easier.

Either way, the best-prepared organizations will be those that can respond without putting their businesses at risk.

The question isn't simply how quickly we can find and patch vulnerabilities.

It's whether we've designed systems that allow us to do something about them.

# Prior art: AI resume and career tools

Research for [#4](https://github.com/voidforall/your-next-resume/issues/4). Terms are used as defined in [CONTEXT.md](../../CONTEXT.md).

Everything below is cited. Where a vendor page could not be fetched, the number is marked **unverified** rather than estimated.

---

## 1. The headline finding

Nobody ships the Projection.

The market splits cleanly into two halves that never touch:

- **Resume tools** operate strictly in the present tense. Their entire pitch is *your true experience, said better* — reorder, requantify, keyword-match. The incumbent agent skill states it outright: "You're not lying or fabricating - you're HIGHLIGHTING the most relevant parts of your true experience" ([resume-tailor SKILL.md](https://github.com/Paramchoudhary/ResumeSkills/blob/main/skills/resume-tailor/SKILL.md)).
- **Career-roadmap and gap tools** operate in the future tense, but their output is a *list*: a match score, a ranked pile of missing skills, some suggested courses. They never render the resume that the plan produces.

The idea of writing the resume you want and then earning it exists — but as a journaling exercise in coaching content, not as a tool. The clearest statement of it is a life-coach blog post: a "Future Resume" that "captures all the goals, career milestones, and new skill sets that you want to achieve in the future" ([Kelsey Reidl](https://www.kelseyreidl.com/blog/how-to-write-your-future-resume-in-order-to-manifest-the-life-career-of-your-dreams)). It has no honesty contract, no Evidence, no artifact.

**So the gap we occupy is not "an AI resume tool." It is the join.** The Projection is the visual payoff that the roadmap category has never had, and the Traceability Rule is the honesty contract that makes a future-tense resume shippable at all. No tool found does both.

---

## 2. Existing agent skills — we are not first, and the incumbent is large

### Paramchoudhary/ResumeSkills — the one that matters

| | |
|---|---|
| Stars / forks | 1,967 / 163 |
| Created | 2026-01-30 |
| License | MIT |
| Skills | 22 |
| **Installs (skills.sh)** | **147.3K total** |

Sources: [repo](https://github.com/Paramchoudhary/ResumeSkills), [skills.sh listing](https://skills.sh/Paramchoudhary/ResumeSkills).

Top skills by install count on skills.sh: `resume-ats-optimizer` (9.5K), `linkedin-profile-optimizer` (8.4K), `resume-bullet-writer` (8.0K), `resume-tailor` (7.3K), `tech-resume-optimizer` (7.2K).

What it is: 22 flat `SKILL.md` files covering ATS optimisation, bullet writing, tailoring, cover letters, LinkedIn, interview prep, salary negotiation, executive resumes, academic CVs, offer comparison. It vendors the same skill tree into eight agent directories (`.claude/`, `.cursor/`, `.codex/`, `.gemini/`, `.windsurf/`, `.opencode/`, `.agents/`, `.agent/`) and installs with `npx skills add Paramchoudhary/ResumeSkills -g -y`.

Three things to take from reading its files:

1. **It has no artifact.** Every skill's output is chat text and advice. There is no PDF, no HTML page, no before/after. Our diptych has no competitor in this channel.
2. **It has no roadmap.** Twenty-two skills, none future-tense. `career-changer-translator` is the closest and it only re-describes existing experience.
3. **It has an honesty hole we should name.** `resume-quantifier` is described as "Find opportunities to add metrics, **estimate when numbers unknown**" ([README](https://github.com/Paramchoudhary/ResumeSkills#available-skills)). Inventing a metric for a real past job is precisely the fabrication our contract forbids — and it is a *harder* lie than a Projected Bullet, because it is unmarked and undated. This is a positioning gift: the popular skill invents numbers about the past; we mark and date claims about the future.

### Xopoko/career-skills — the closest philosophical neighbour

[github.com/Xopoko/career-skills](https://github.com/Xopoko/career-skills) — 1 star, created 2026-08-13, MIT. Twenty skills behind one router, described as "Evidence-first career and job-search workflows," where "facts stay linked to evidence, uncertainty remains visible, and drafts do not silently become external actions." It ships `.claude-plugin/marketplace.json` plus Codex and Cursor plugin manifests, a network-free Python toolkit, and an `examples/trust-demo/` containing `evidence.jsonl`, `facts.jsonl` and a `supported-claim-manifest.json`.

Very small, very new, and it has independently arrived at evidence-linking. It is still present-tense and artifact-less. Worth watching, not worth worrying about — but it means "evidence-first" alone is not a differentiator. **Traceable *projection* is.**

### The rest

- [Anilinfo2015/ats-resume-claude-skill](https://github.com/Anilinfo2015/ats-resume-claude-skill) — 1 star. Interviews the user, emits Markdown, converts to PDF.
- [ficilcom/otame4-work-skills](https://github.com/ficilcom/otame4-work-skills) — 0 stars, created 2026-08-28. Japanese job hunting.

GitHub code search for `SKILL.md` files containing "resume" returns nothing beyond these — the category is thin outside the one incumbent.

---

## 3. Commercial tools: what they do and charge

Prices below are read from the vendor's own pricing page unless flagged.

### Rezi ([pricing](https://www.rezi.ai/pricing))
- Free: $0 — 1 resume, 1 AI interview, 3 PDF downloads
- Pro: **$29/month**
- Lifetime: **$149 one-time**
- Enterprise: $99/month per 200 users

Output: a formatted resume PDF plus a "Rezi Score." Present-tense only.

### Kickresume ([pricing](https://www.kickresume.com/en/pricing/))
- Free: €0 — 4 resume templates, unlimited downloads
- Yearly: **€8/month (€96/year)**
- Quarterly: €18/month (€54 per quarter)
- Monthly: €24/month

Kickresume is the only commercial tool found with a future-facing feature: **AI Career Map** ([product page](https://www.kickresume.com/en/ai-career-map/)). Upload a resume, answer a questionnaire on lifestyle, salary and aspirations, and it returns "a set of personalized career paths" with salaries, growth potential and skill-gap analysis. Its output is *occupations you could move to* — a fan of destinations. It is not a dated set of Milestones, it names no Evidence, and it does not render the resume that the path produces. This is the nearest miss in the whole survey and it still misses.

### Teal and Jobscan — **unverified**
Both pricing pages defeat automated fetch (`tealhq.com/pricing` returns HTTP 403; `jobscan.co/pricing` 301s into a logged-in app route). Third-party comparisons put Teal+ at ~$29/month and Jobscan Premium at ~$49.95/month, but **we could not confirm either from the vendor and should not quote them.** Both are, functionally, job-tracker plus match-score plus resume-builder bundles; neither produces a future-tense resume.

### Free gap-analyser lead magnets
[Prosumely Skill Gap Analyzer](https://www.prosumely.com/career-tools/skill-gap-analyzer), [Prosumely Career Roadmap Generator](https://www.prosumely.com/career-tools/career-roadmap-generator), [Junia.ai Career Path Generator](https://www.junia.ai/tools/career-path-generator), [Resumly Skills Gap Analyzer](https://www.resumly.ai/skills-gap-analyzer), [SkillShift.ai](https://skillshift.ai/), [Apt AI](https://www.tryapt.ai/ai-career-path-generator).

A commodity category. All hosted, all require uploading a resume to a server, all output the same shape: a match percentage, skills bucketed present/partial/missing, and a suggested course list. None is dated, none names checkable Evidence, none produces a document. They exist to capture emails.

---

## 4. Open source: what the dev audience actually stars

| Repo | Stars | What it is |
|---|---:|---|
| [amruthpillai/reactive-resume](https://github.com/amruthpillai/reactive-resume) | 41,892 | Self-hostable resume builder, privacy-first |
| [srbhr/Resume-Matcher](https://github.com/srbhr/Resume-Matcher) | 28,266 | Local resume/JD matching, "locally" is in the tagline |
| [rendercv/rendercv](https://github.com/rendercv/rendercv) | 17,442 | YAML → PDF, one command |
| [xitanggg/open-resume](https://github.com/xitanggg/open-resume) | 8,868 | In-browser builder + ATS parser, no signup |
| [jsonresume/resume-cli](https://github.com/jsonresume/resume-cli) | 4,719 | JSON Resume schema tooling |

Star counts read from the GitHub API on 2026-08-29.

Every single one of these wins on the same two axes: **plaintext/version-controllable** and **runs on your machine**. Not one wins on AI quality. That is the audience we are shipping to, and it validates the local-only and one-command decisions far more strongly than it validates any model-quality pitch.

---

## 5. What has gotten traction on Hacker News, and the shape of the post

Scores from the [HN Algolia API](https://hn.algolia.com/api).

### Show HN scores in this category
| Points | Comments | Date | Post |
|---:|---:|---|---|
| 656 | 198 | 2023-06-25 | [Open-source resume builder and parser (OpenResume)](https://news.ycombinator.com/item?id=36470297) |
| 382 | 108 | 2020-10-14 | [I wrote a book on writing good developer resumes](https://news.ycombinator.com/item?id=24777640) |
| 301 | 194 | 2025-05-05 | [My AI Native Resume](https://news.ycombinator.com/item?id=43891245) |
| 265 | 165 | 2019-09-17 | [A resume generator for developers](https://news.ycombinator.com/item?id=20995056) |
| 240 | 66 | 2020-03-28 | [RxResume](https://news.ycombinator.com/item?id=22709183) |
| 209 | 116 | 2017-10-06 | [Resume Worded](https://news.ycombinator.com/item?id=15417975) |
| 100 | 41 | 2025-12-21 | [RenderCV — YAML to PDF](https://news.ycombinator.com/item?id=46344616) |

The ceiling for a resume Show HN is roughly 650 points, and it was hit by the *most boring possible pitch*: free, open source, no signup, runs in your browser.

### The shape of the successful post

Both top posts follow an identical structure, and neither contains a single marketing adjective.

**OpenResume** ([post text](https://news.ycombinator.com/item?id=36470297)) — personal-mentoring origin story, then four numbered highlights: real-time preview; ATS-friendly to Greenhouse and Lever; "**Privacy focus - no sign up is required and data is stored locally in browser that only users have access**"; PDF import. Then a *second free utility* (the parser) as a no-commitment hook, and a technical article explaining the parser algorithm.

**RenderCV** ([post text](https://news.ycombinator.com/item?id=46344616)) — opens on personal pain: "I built RenderCV because Word kept breaking my layout and LaTeX was overkill." Then the one-liner: "Run `rendercv render cv.yaml` → get a perfectly typeset PDF." Then numbered highlights led by "Version-controllable: Your CV is just text. Diff it, tag it." Then hard traction numbers: "120k+ total PyPI downloads, 100% test coverage."

The recipe, for [#13](https://github.com/voidforall/your-next-resume/issues/13):
1. A concrete personal frustration in the first sentence. Not a market.
2. The single command, shown literally, in the first three lines.
3. Numbered highlights, each a checkable fact. Privacy/local placed high.
4. Something free and instant to try that needs no commitment.
5. Real numbers if you have them; silence if you don't.

### The threads that outscore every Show HN

The discussion posts beat the tools by 2x, and they are all about the system being broken:

- **[HackerRank open sourced its ATS. My resume scored 90/100. Oh wait 74. No – 88](https://news.ycombinator.com/item?id=48713832)** — 1,032 points, 433 comments, 2026-06-29. The single most important thread in this survey. See §6.
- **[We created a fake language to root out resume liars](https://news.ycombinator.com/item?id=26408181)** — 562 points, 758 comments.
- **[Resume Tip: Hacking "AI" screening of resumes](https://news.ycombinator.com/item?id=40489596)** — 512 points, 251 comments.
- **[Why isn't there a universal data format for résumés?](https://news.ycombinator.com/item?id=29960279)** — 428 points, 451 comments.

The energy in this audience is not "help me write a better resume." It is anger at an opaque, arbitrary filter. A tool that reads as *another way to feed the filter* gets a hostile reception. A tool that reads as *building something real instead of gaming the filter* is aligned with where the anger points.

---

## 6. Critique patterns, verbatim

These are the attacks the README has to survive. All quotes are from the linked threads.

**A. Optimising for a score is optimising for noise.**
The HackerRank ATS piece scored the same resume 90, then 74, then 88. The author: "I fail 65% of the time. Same exact resume, different luck." Top comment: *"A computer can never be held accountable, therefore a computer must never make a management decision."* ([quink](https://news.ycombinator.com/item?id=48713832)). Any claim of the form "beats the ATS" is dead on arrival here.

**B. The roadmap prescribes unpaid evenings and weekends — this is the sharpest attack aimed directly at us.**
The HackerRank rubric awarded 35 points for open-source contributions and 30 for personal projects, against 25 for work experience. The response:

> "I don't contribute to open source or have personal projects because I don't spend my free time doing what I do 40 hours a week to make a living. My 15 years of work experience is worth a maximum of 25%, so any company using this idiotic system would pass on me immediately." — [dc3k](https://news.ycombinator.com/item?id=48713832)

> "They are selecting for people who are fine working in their free time. If you contribute to open source you are more likely to contribute to the company on weekends. If instead you have other hobbies or a family that takes up non-work hours you are more likely to drop your pen after forty hours." — [adrianN](https://news.ycombinator.com/item?id=48713832)

Our contract's projectable set is *exactly* this list: side projects, OSS contributions, writing, talks, certifications. A six-month roadmap of self-shipped artifacts is, structurally, a plan for unpaid labour, and it lands hardest on people with caring responsibilities. This is the critique most likely to define the launch thread. See the ticket suggestion at the end.

**C. "You are joining the robots."**
On RenderCV, from someone hiring:
> "I have been through a huge over supply of AI generated CVs using similar tools this year. I am sure this will help people so not bashing the tool per se, but bare in mind that you will be joining the robots." — [Cloudly](https://news.ycombinator.com/item?id=46344616)

**D. Any edge you find is competed away.**
> "this will get patched, as in I'll optimize my resume for this and so will many other people that any edge disintegrates" — [yieldcrv](https://news.ycombinator.com/item?id=48713832)

An advantage claim invites this. A "you will actually have done the thing" claim does not — it is not an arbitrage.

**E. The artifact itself will be sniffed for slop.**
> "This is clearly a real project that was built over several years with human effort (not vibe coded). Which makes it all the more depressing that the author decided to take a massive dump over the entire README.md with AI slop." — [dfajgljsldkjag](https://news.ycombinator.com/item?id=46344616)

> "The voice of the text also sounds condescending in an LLM way, did you use AI to come up with those sections?" — [vasco](https://news.ycombinator.com/item?id=43891245)

Our README, our Projection copy and our Roadmap prose are all AI-authored output about AI-authored output. Em-dash-heavy, tricolon-heavy, "not just X but Y" prose will be read as slop and the tool judged by it.

**F. Hiring-side flat refusal.**
> "Cute, but no. I will absolutely do none of things. You need to make it as easy as possible for me to learn about you. If instructions are necessary it's not easy." — [forrestthewoods](https://news.ycombinator.com/item?id=43891245)

Relevant to [#15](https://github.com/voidforall/your-next-resume/issues/15) and [#9](https://github.com/voidforall/your-next-resume/issues/9): the Roadmap is for the *user*, never for a recruiter. A Stamped Projection must never be pitched as something to send to an employer.

**G. Deception is now assumed by default.**
From the [Greenhouse 2025 AI in Hiring Report](https://www.greenhouse.com/newsroom/an-ai-trust-crisis-70-of-hiring-managers-trust-ai-to-make-faster-and-better-hiring-decisions-only-8-of-job-seekers-call-it-fair) (19 Nov 2025; 4,136 respondents — 2,900 job seekers and 1,236 recruiters/hiring managers across US, UK, Ireland, Germany):
- 91% of recruiters have spotted candidate deception
- 65% of hiring managers have caught applicants using AI deceptively
- 41% of US job seekers admit using prompt injections to bypass AI filters
- 70% of hiring managers trust AI to make faster and better hiring decisions; only 8% of job seekers call it fair
- 46% say their trust in hiring decreased over the past year

A tool that generates a resume describing things you have not done will be read, on the title alone, as entry number 42 in that list. The Stamp and the refusal set have to be visible in the first screen of the README, not buried in a docs page.

**H. Volume context.** LinkedIn reportedly sees ~11,000 applications per minute, up 45% year over year ([eWeek](https://www.eweek.com/news/ai-job-applications-linkedin/), citing the [NYT](https://www.nytimes.com/2025/06/21/business/dealbook/ai-job-applications.html)). *Second-hand; LinkedIn's own release was not located.* The implication is that mass-tailoring tools are in a losing arms race — which is an argument for our position, not a threat to it.

---

## How we differ

Blunt, tied to the settled decisions.

1. **We produce the Projection. Nobody else does.** Every commercial and open-source resume tool is present-tense. Every roadmap tool outputs a list of skills and courses. Nothing found renders the future resume as a document. The before/after diptych has no competitor in any channel surveyed.
2. **Traceable projection, not score-chasing.** Every other tool sells a number — Rezi Score, Jobscan match rate, gap percentage. We sell a Traceability Rule: no Projected Bullet without a Milestone, no Milestone without Evidence. That is the one claim the [HackerRank ATS thread](https://news.ycombinator.com/item?id=48713832) cannot dismiss as noise, because it is not a claim about a filter.
3. **Roadmap-first, and we say so.** Kickresume's AI Career Map hands you destinations; the free gap analysers hand you a to-do list of courses. We generate the Roadmap *before* the Projection, and the Projection is derived from it. The plan is the product; the resume is the picture of the plan having worked.
4. **Local-only, against a category that is 100% hosted.** Every commercial tool and every free gap analyser requires uploading a resume to a server. The five most-starred open-source resume projects (41.9K, 28.3K, 17.4K, 8.9K, 4.7K stars) all win on privacy and plaintext. Our no-upload, no-telemetry, no-API-key-beyond-your-own-agent stance is the single most load-bearing differentiator with this audience.
5. **One command, one artifact pair.** Rezi is a subscription workflow; Teal is a tracker; ResumeSkills is 22 skills you have to know the names of and which output chat text. We are one invocation producing two files. RenderCV's Show HN put `rendercv render cv.yaml` in line three; we do the same.
6. **We mark what is not true; the popular incumbent invents what is.** ResumeSkills' `resume-quantifier` "estimate[s] when numbers unknown" — fabricated metrics on past jobs, unmarked. Our Stamp marks every Projected and Reframed Bullet and repeats the declaration in PDF metadata. State this contrast; it is the cleanest honesty story in the category.
7. **Built for tech, specifically.** The generic tools recommend "a cloud certification." Our Roadmap names real repos, real OSS projects, real systems. The HN audience is exactly the audience whose Milestones can be made concrete, and the only one where roadmap quality is defensible.

## Critiques to pre-empt

Each of these needs an answer visible in the README, not in a sub-page.

1. **"This is a fabricated-resume generator."** Answer first, above the fold: the Stamp, the Traceability Rule, the four refusals, and the never-projectable list (title, employer, promotion, comp, degrees). Show the marked-up Projection in the hero image so the reader sees the marks before they read a word.
2. **"So your roadmap is just: work unpaid nights and weekends."** The strongest attack we will get ([dc3k](https://news.ycombinator.com/item?id=48713832), [adrianN](https://news.ycombinator.com/item?id=48713832)). Do not hand-wave it. Say what the honest answer is: the Projection Window is short precisely so the ask is bounded, Milestones should prefer work you can do inside your current job, and a smaller Projection is a valid outcome.
3. **"Another ATS-beating tool."** Never make an ATS claim. Scores are non-deterministic and this audience has the receipts. The pitch is *become the candidate*, not *pass the filter*.
4. **"Aren't you making the application flood worse?"** No: one target, one roadmap, one command, and there is no auto-apply, no mass-tailoring, no job scraping. Say it explicitly — [#1](https://github.com/voidforall/your-next-resume/issues/1) already rules scraping out of scope; the README should turn that constraint into a stated position.
5. **"Where does my resume go?"** Answer in the first paragraph: nowhere. Local-only, no telemetry, no uploads. This is the highest-signal sentence in the whole README for the HN audience, per OpenResume's 656-point post.
6. **"Is this slop?"** The README, the Roadmap prose and the Projection copy will be read as evidence about output quality. Ruthless copy discipline, real screenshots, no adjectives. See [dfajgljsldkjag](https://news.ycombinator.com/item?id=46344616) and [vasco](https://news.ycombinator.com/item?id=43891245).
7. **"Why not just ask Claude?"** Because the contract is the product. An unconstrained model will happily write you a promotion. Lead with what the skill *refuses*.
8. **"You're not first — ResumeSkills has 147K installs."** True and worth saying plainly. They optimise the present; we project the future and carry a contract for it. Being second in a category we are not actually in is a non-issue, and pre-empting it beats being caught by it in the launch thread.

---

*Compiled 2026-08-29. Star counts and install counts read on that date. Teal and Jobscan prices deliberately omitted — vendor pages could not be fetched and no price should be quoted without one.*

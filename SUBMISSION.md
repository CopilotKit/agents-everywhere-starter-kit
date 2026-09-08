# Submission checklist

Five deliverables, all due by **17:00**. Demos run 15:30–16:30, so in practice
this needs to be written *before* you demo, not after.

## 1. Title
<!-- A clear name. Not a pun on "agent". -->

## 2. Written description

The brief asks for three specific things — answer all three explicitly:

**What you built**
<!-- One paragraph. -->

**Who it is for**
<!-- Name a real person in a real situation, not a market segment. -->

**Why the context matters**
<!-- The scoring question. What can this agent do *because* it lives here that
     it could not do in a separate chat window? If the answer is "nothing, it's
     just more convenient", you are on rung 1 of the Context Ladder — go back
     and use the surface. -->

## 3. Public GitHub repository

- [ ] Public, and it actually builds from a clean clone
- [ ] `.env` is **not** committed (`git log --all --diff-filter=A -- .env` returns nothing)
- [ ] README says what it is and how to run it in under ten lines
- [ ] `npm run typecheck` passes

## 4. Two-minute video

- [ ] Under 2:00
- [ ] Opens on the surface, not on your editor
- [ ] Shows one real interaction end to end — no narrating over dead air
- [ ] Shows the approval gate being **declined** at least once
- [ ] Audio is audible

> GitHub only inline-plays video uploaded through a comment box (a
> `user-attachments` URL). Raw repo files and release assets serve
> `application/octet-stream` with `nosniff`, so a committed `<video>` stays dead.
> Drag the file into a GitHub comment, copy the resulting URL, then delete the
> comment.

## 5. Social post

- [ ] Public
- [ ] Tags the sponsors — OpenAI, CopilotKit, OpenRouter, plus whichever infra
      partners you actually used (Exa, Trigger.dev, Auth0, Mozilla.ai,
      Ambiguous AI) and your city's local sponsors
- [ ] Links the repo
- [ ] Has the video or a screenshot of the native card — a text-only post about
      an agent that renders UI undersells it

## Before you submit

- [ ] Someone who has never seen it ran the quickstart from a clean clone
- [ ] `npm run channel:status` is clean
- [ ] No secrets in the repo, the video, or the screenshots

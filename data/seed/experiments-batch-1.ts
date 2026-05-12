// Postmark seed data — batch 1 (exp_001–exp_010).
//
// Quality-gate batch: hand-crafted, not LLM-generated. Loaded by the
// seed script in Phase 2.4. Embeddings are computed at seed time
// (left as [] here). For in_review experiments, p_value and
// sample_size are 0 as sentinels — no measurement collected yet;
// Zod validators in Phase 2.3 will allow this when lifecycle is
// pre-launch (draft/in_review/scheduled).

import type { Experiment } from "@/types";

export const experimentsBatch1: Experiment[] = [
  // ─── exp_001 · Onboarding · concluded · iterated ──────────────────
  {
    id: "exp_001",
    title: "60-second 'First AI Edit' fast-path in onboarding",
    hypothesis:
      "Routing new users into a guided 60-second AI portrait edit immediately after signup — replacing the current 4-screen feature tutorial — will lift D7 retention by 1pp+ by getting users to their first 'aha' moment before they bounce. Hypothesis is strongest for users acquired via paid social, who arrive with low brand context and high bounce risk.",
    category: "onboarding",
    lifecycle: "concluded",
    decision: "iterated",
    start_date: "2026-03-02",
    end_date: "2026-03-30",
    duration_days: 28,
    segment: "New iOS + Android users, US, English, paid + organic",
    segment_size: 482_000,
    primary_metric: "D7 retention",
    primary_metric_baseline: 15.2,
    primary_metric_treatment: 16.4,
    lift_percent: 7.9,
    p_value: 0.03,
    sample_size: 482_000,
    guardrail_metrics: [
      { name: "Android crash rate (per 1k sessions)", baseline: 0.42, treatment: 0.68, delta_percent: 61.9, status: "fail" },
      { name: "iOS crash rate (per 1k sessions)", baseline: 0.31, treatment: 0.33, delta_percent: 6.5, status: "pass" },
      { name: "Time to first completed edit (sec)", baseline: 184, treatment: 67, delta_percent: -63.6, status: "pass" },
      { name: "App-store rating (28-day)", baseline: 4.6, treatment: 4.4, delta_percent: -4.3, status: "warn" },
    ],
    segment_breakdown: [
      { segment: "iOS, paid social", lift_percent: 11.4, p_value: 0.004, sample_size: 138_000 },
      { segment: "iOS, organic", lift_percent: 6.1, p_value: 0.07, sample_size: 102_000 },
      { segment: "Android, paid social", lift_percent: 8.2, p_value: 0.04, sample_size: 142_000 },
      { segment: "Android, organic", lift_percent: 4.8, p_value: 0.18, sample_size: 100_000 },
    ],
    what_we_learned:
      "Routing new users to an AI portrait fast-path lifts D7 retention meaningfully (+1.2pp / +7.9% relative, p=0.03), and the iOS-paid-social cell — exactly the cohort with the worst baseline D7 — saw the largest effect (+11.4%, p=0.004). But the Android variant tripped a hard guardrail: crash rate jumped 62% because the on-device AI portrait model OOMs on devices with <4GB RAM (~32% of our Android base in this segment). We shipped the fast-path to iOS, paused Android, and chartered a follow-up to rebuild Android on a quantized model (~120MB vs current 380MB). Open question we did NOT resolve: whether the Android crash spike artificially depressed the Android lift estimate. The Android-paid-social cell still showed +8.2% even with the crashes — likely a floor. Pre-flight any future on-device AI feature launches against device-RAM distribution; this is the second time in 18 months we've shipped a model that excluded a third of Android.",
    failure_modes: ["segment_imbalance"],
    team: "Onboarding",
    pm: "Priya Subramanian",
    embedding: [],
    tags: ["onboarding_friction", "d7_retention", "ai_feature_rollout", "platform_disparity", "guardrail_breach", "paid_acquisition"],
  },

  // ─── exp_002 · Monetization · concluded · shipped ─────────────────
  {
    id: "exp_002",
    title: "Show AI paywall after first 'wow' edit, not session 1",
    hypothesis:
      "Moving the AI feature paywall from session 1 (current) to immediately after a free user completes their first AI portrait edit will lift free-to-paid conversion by 15%+ by aligning the conversion ask with peak intent. Risk: fewer trials start because users hit the paywall later; net paid revenue may still rise if the trials that start convert better.",
    category: "paywall",
    lifecycle: "concluded",
    decision: "shipped",
    start_date: "2026-02-09",
    end_date: "2026-03-02",
    duration_days: 21,
    segment: "Free activated users (≥1 edit in first 7 days), iOS + Android, global",
    segment_size: 320_000,
    primary_metric: "Free-to-paid conversion rate (14-day window)",
    primary_metric_baseline: 2.8,
    primary_metric_treatment: 3.6,
    lift_percent: 28.6,
    p_value: 0.001,
    sample_size: 320_000,
    guardrail_metrics: [
      { name: "Trial start rate", baseline: 8.2, treatment: 7.4, delta_percent: -9.8, status: "warn" },
      { name: "Trial-to-paid rate (conditional)", baseline: 31.4, treatment: 47.8, delta_percent: 52.2, status: "pass" },
      { name: "App-store rating (21-day)", baseline: 4.6, treatment: 4.6, delta_percent: 0.0, status: "pass" },
      { name: "Crash rate (per 1k sessions)", baseline: 0.37, treatment: 0.38, delta_percent: 2.7, status: "pass" },
    ],
    segment_breakdown: [
      { segment: "iOS, US", lift_percent: 32.1, p_value: 0.0005, sample_size: 118_000 },
      { segment: "Android, US", lift_percent: 24.3, p_value: 0.008, sample_size: 96_000 },
      { segment: "iOS, intl", lift_percent: 18.4, p_value: 0.04, sample_size: 64_000 },
      { segment: "Android, intl", lift_percent: 21.7, p_value: 0.03, sample_size: 42_000 },
    ],
    what_we_learned:
      "Aligning the paywall with the AI-edit completion moment lifted free-to-paid conversion 28.6% relative (2.8% → 3.6%, p=0.001) — our biggest monetization win of FY26 so far. The trade we made was a 9.8% drop in trial starts; net paid revenue still rose because the trials that DID start converted at 1.5x the baseline trial-to-paid rate (47.8% vs 31.4%). Counter-intuitive finding: the international cells (which we'd assumed would be price-sensitive) still showed +18–22% — meaningful wins, just slightly smaller. The mechanism appears to be peak-intent, not price-sensitivity. Hypothesis we did NOT test but should: does 'aha placement' generalize to non-AI features (filters, presets)? The pattern is now the default playbook, but we don't know if 'aha' is feature-specific. Next: exp_005 trial-length test inherits the aha-placement assumption — we'll find out the hard way if it doesn't generalize.",
    failure_modes: [],
    team: "Monetization",
    pm: "David Okafor",
    embedding: [],
    tags: ["paywall_placement", "aha_moment", "ai_feature_rollout", "conversion_lift", "monetization_funnel", "trial_funnel"],
  },

  // ─── exp_003 · Lifecycle · concluded · killed (D7 subplot) ────────
  {
    id: "exp_003",
    title: "18-hour re-engagement push for silent new users",
    hypothesis:
      "Sending a single AI-tip push 18 hours after install — to users who haven't opened the app since signup — will lift D7 retention by 2pp+ in this silent cohort, by recovering users who got distracted before their first edit. Minimal cannibalization expected since silent-after-18h users have very low organic return probability.",
    category: "notification",
    lifecycle: "concluded",
    decision: "killed",
    start_date: "2026-02-15",
    end_date: "2026-03-08",
    duration_days: 21,
    segment: "New users silent for 18h post-install, iOS + Android, US",
    segment_size: 215_000,
    primary_metric: "D7 retention (silent-cohort baseline)",
    primary_metric_baseline: 11.8,
    primary_metric_treatment: 12.4,
    lift_percent: 5.1,
    p_value: 0.21,
    sample_size: 215_000,
    guardrail_metrics: [
      { name: "Push notification opt-out rate (weekly)", baseline: 0.4, treatment: 1.8, delta_percent: 350.0, status: "fail" },
      { name: "App-store rating (28-day)", baseline: 4.6, treatment: 4.5, delta_percent: -2.2, status: "warn" },
      { name: "Uninstall rate (14-day)", baseline: 18.2, treatment: 19.1, delta_percent: 4.9, status: "warn" },
    ],
    segment_breakdown: [
      { segment: "iOS, US", lift_percent: 6.2, p_value: 0.18, sample_size: 102_000 },
      { segment: "Android, US", lift_percent: 4.1, p_value: 0.34, sample_size: 113_000 },
    ],
    what_we_learned:
      "A single 18-hour re-engagement push moved D7 retention nominally (+0.6pp / +5.1% relative) but didn't reach significance (p=0.21) and — much worse — push opt-out rate spiked 4.5x. Modeled long-term cost: if we'd shipped, the permission loss in this cohort would have outweighed any D7 lift within 60 days, breaking the Lifecycle team's ability to send ANY push to this segment. Killed. The deeper issue this surfaced: we don't have a 'permission budget' framework — every team adds notifications independently and the user pays the cost only at opt-out time. Two open questions: (1) Would *content-personalized* push (vs the generic 'try an AI edit') have changed opt-out? Pre-tested copy didn't suggest so, but n was small. (2) Is there an alternate channel (in-app modal on next session) that captures the same D7 lift without permission cost? Filed as exp_006 (currently paused while we get UXR signal on the modal pattern). Cross-experiment lesson: this is the third Lifecycle test in 14 months killed by an opt-out spike. Need to formalize a permission-budget check in pre-flight.",
    failure_modes: ["underpowered"],
    team: "Lifecycle",
    pm: "Maria Chen",
    embedding: [],
    tags: ["push_fatigue", "d7_retention", "notification_opt_out", "silent_user_recovery", "permission_budget", "lifecycle_messaging"],
  },

  // ─── exp_004 · Growth · live · — (international) ──────────────────
  {
    id: "exp_004",
    title: "Localized referral mechanic in Brazil (Pix payment integration)",
    hypothesis:
      "Integrating Brazil's Pix instant-payment system into the referral flow — one-tap reward redemption in BRL instead of in-app credits — will lift referral activation in Brazil by 50%+ and drive a 2pp lift in Brazilian D7 retention. Referrals from friends carry social proof that paid acquisition doesn't.",
    category: "growth_loop",
    lifecycle: "live",
    decision: null,
    start_date: "2026-04-27",
    end_date: null,
    duration_days: 35,
    segment: "Brazil, iOS + Android, all acquisition channels",
    segment_size: 120_000,
    primary_metric: "Referral activation rate (invitee installs + first edit)",
    primary_metric_baseline: 7.4,
    primary_metric_treatment: 11.8,
    lift_percent: 59.5,
    p_value: 0.008,
    sample_size: 47_200,
    guardrail_metrics: [
      { name: "Fraud rate (gamed referrals)", baseline: 0.2, treatment: 0.6, delta_percent: 200.0, status: "warn" },
      { name: "Customer support tickets (BR, daily)", baseline: 14, treatment: 22, delta_percent: 57.1, status: "warn" },
      { name: "App-store rating (Brazil)", baseline: 4.5, treatment: 4.5, delta_percent: 0.0, status: "pass" },
    ],
    segment_breakdown: [
      { segment: "BR iOS", lift_percent: 71.2, p_value: 0.003, sample_size: 24_100 },
      { segment: "BR Android", lift_percent: 52.4, p_value: 0.02, sample_size: 23_100 },
    ],
    what_we_learned:
      "Live experiment — interim observations only (day 14 of 35). Early lift is dramatic (+59.5% on referral activation, p=0.008) and comfortably exceeds the +50% hypothesis floor. Concerning signal: fraud rate has tripled (still <1% absolute, but slope is steep). Two recent fraud cases involved single users with 8+ accounts redeeming Pix to the same key — instrumentation team has shipped a guardrail patch but its effect isn't yet measurable. Decision: let this run to sample target (120k invitees, ~21 more days) but escalate to weekly fraud reviews. If fraud holds <1%, this likely ships globally with country-specific payment integrations (India UPI is the obvious next; India team prepping pre-flight). Open question: does the lift come from Pix specifically, or from any local instant-payment integration? Need to test in a non-Pix market before declaring 'payment localization is the win.'",
    failure_modes: [],
    team: "Growth",
    pm: "Priya Subramanian",
    embedding: [],
    tags: ["international", "brazil", "referral_loop", "pix_integration", "payment_localization", "d7_retention", "fraud_risk"],
  },

  // ─── exp_005 · Monetization · concluded · reverted ────────────────
  {
    id: "exp_005",
    title: "Extending free trial from 7 to 14 days",
    hypothesis:
      "Extending the Pixmate Pro free trial from 7 to 14 days will increase trial-to-paid conversion by 10%+ by giving users more time to integrate Pro features into their workflow before the conversion ask. Risk: longer trials mean more 'forgot to cancel' revenue but also more abandonment.",
    category: "pricing",
    lifecycle: "concluded",
    decision: "reverted",
    start_date: "2026-01-08",
    end_date: "2026-02-05",
    duration_days: 28,
    segment: "Trial-eligible users (free, ≥3 edits), iOS + Android, global",
    segment_size: 89_000,
    primary_metric: "Trial-to-paid conversion rate (30-day window)",
    primary_metric_baseline: 31.4,
    primary_metric_treatment: 36.8,
    lift_percent: 17.2,
    p_value: 0.002,
    sample_size: 89_000,
    guardrail_metrics: [
      { name: "Trial start rate", baseline: 8.2, treatment: 8.0, delta_percent: -2.4, status: "pass" },
      { name: "App-store rating (28-day)", baseline: 4.6, treatment: 4.6, delta_percent: 0.0, status: "pass" },
      { name: "Customer support tickets (trial-related)", baseline: 22, treatment: 24, delta_percent: 9.1, status: "pass" },
      { name: "30-day-post-conversion churn rate (POST-LAUNCH)", baseline: 14.2, treatment: 22.8, delta_percent: 60.6, status: "fail" },
    ],
    segment_breakdown: [
      { segment: "iOS, US", lift_percent: 18.4, p_value: 0.001, sample_size: 34_000 },
      { segment: "Android, US", lift_percent: 16.2, p_value: 0.008, sample_size: 28_000 },
      { segment: "iOS, intl", lift_percent: 14.1, p_value: 0.04, sample_size: 17_000 },
      { segment: "Android, intl", lift_percent: 15.8, p_value: 0.06, sample_size: 10_000 },
    ],
    what_we_learned:
      "We shipped what looked like an unambiguous win (+17.2% trial-to-paid, p=0.002 across all segments) and reverted it 47 days post-launch because 30-day-post-conversion churn jumped 60% relative (14.2% → 22.8%). The users we 'won' on the longer trial were converting under different conditions — the 14-day cohort had higher subscription regret. In hindsight (painful), our experiment had no churn guardrail; we measured conversion as the terminal event. The downstream behavior wasn't visible until we already had two months of treatment users in our paid base. This is the canonical 'metric myopia' failure. Three lessons institutionalized after the revert: (1) ALL monetization tests now require a 30-day-post-conversion-retention guardrail before they can ship, not just primary conversion metrics. (2) The pre-flight check should pattern-match new hypotheses against any conversion test that didn't include retention guardrails — flag for review. (3) David proposed a 'conversion-quality score' that weights conversions by 30/60/90 day retention; in productization discussion. Cross-experiment cost: this is the only shipped-then-reverted experiment in the last 18 months at this scale — but the cost was real (~$340K in refunds + support overhead). Future hires reading this: Postmark exists to make sure this kind of revert never happens again.",
    failure_modes: [],
    team: "Monetization",
    pm: "David Okafor",
    embedding: [],
    tags: ["trial_length", "trial_to_paid", "post_launch_churn", "reverted_experiment", "metric_myopia", "monetization_funnel", "guardrail_gap"],
  },

  // ─── exp_006 · Lifecycle · paused · — (D7 subplot) ────────────────
  {
    id: "exp_006",
    title: "In-app modal at session 2 (replacement for exp_003's push)",
    hypothesis:
      "After exp_003 showed pushes destroy notification permissions, test whether an in-app modal triggered on session 2 (if user hasn't completed first edit yet) lifts D7 retention by 1pp+ without permission cost. Triggered only for users who returned but haven't edited.",
    category: "retention",
    lifecycle: "paused",
    decision: null,
    start_date: "2026-04-08",
    end_date: null,
    duration_days: 21,
    segment: "Returning new users, session 2, no first-edit completion, iOS + Android, US",
    segment_size: 70_000,
    primary_metric: "D7 retention (session-2 cohort)",
    primary_metric_baseline: 18.3,
    primary_metric_treatment: 19.1,
    lift_percent: 4.4,
    p_value: 0.34,
    sample_size: 14_000,
    guardrail_metrics: [
      { name: "Modal dismiss rate", baseline: 0.0, treatment: 73.0, delta_percent: 0.0, status: "warn" },
      { name: "Session-2 to session-3 conversion", baseline: 31.2, treatment: 28.4, delta_percent: -9.0, status: "warn" },
      { name: "App-store rating (28-day)", baseline: 4.6, treatment: 4.6, delta_percent: 0.0, status: "pass" },
    ],
    segment_breakdown: [
      { segment: "iOS + Android, US (combined — too small to split)", lift_percent: 4.4, p_value: 0.34, sample_size: 14_000 },
    ],
    what_we_learned:
      "Paused at day 7 of a planned 21-day run after user research flagged that the modal's 73% dismissal rate suggests it's experienced as friction, not help. Early signal: session-2-to-session-3 conversion actually dropped 9% in treatment — the modal may be triggering bounce, not engagement. Going back to design with the UXR team to rework the modal as a contextual nudge embedded in the home screen rather than a blocking surface. Re-launch planned for May once redesign lands. Open question: is the issue with modals categorically (any modal experienced as friction), or with THIS modal's copy/timing/dismissal UX? We don't know. Expensive to find out — each iteration costs a 21-day cycle. Maria has proposed a multivariate test on next iteration (3 modal variants + control) to compress the loop. Cross-experiment hook: this is the second time in 6 months we've paused a Lifecycle test mid-run on UXR signal (the first was the 2025 Q4 winback email pause). Pattern: when treatment introduces a NEW surface, default to a 7-day UXR check-in before committing to the full window.",
    failure_modes: ["underpowered"],
    team: "Lifecycle",
    pm: "Maria Chen",
    embedding: [],
    tags: ["push_fatigue", "d7_retention", "in_app_modal", "session_2", "permission_budget", "paused_experiment", "uxr_signal"],
  },

  // ─── exp_007 · Lifecycle · concluded · inconclusive ───────────────
  {
    id: "exp_007",
    title: "AI-generated 'remix' email for day-30+ lapsed users",
    hypothesis:
      "Sending a single personalized email at day 30 of inactivity — featuring an AI-generated 'remix' of the user's last edited photo — will lift 60-day reactivation rate by 3pp+ among lapsed users. Personalization is the key; generic winback emails haven't worked historically.",
    category: "retention",
    lifecycle: "concluded",
    decision: "inconclusive",
    start_date: "2026-01-22",
    end_date: "2026-04-02",
    duration_days: 70,
    segment: "Lapsed users (no edit in 30+ days), email-permissioned, iOS + Android, global",
    segment_size: 110_000,
    primary_metric: "60-day reactivation rate",
    primary_metric_baseline: 4.2,
    primary_metric_treatment: 5.1,
    lift_percent: 21.4,
    p_value: 0.08,
    sample_size: 110_000,
    guardrail_metrics: [
      { name: "Email unsubscribe rate (post-send)", baseline: 2.1, treatment: 2.8, delta_percent: 33.3, status: "warn" },
      { name: "Spam-mark rate", baseline: 0.3, treatment: 0.4, delta_percent: 33.3, status: "pass" },
      { name: "Cost per reactivated user ($)", baseline: 0.18, treatment: 0.42, delta_percent: 133.3, status: "warn" },
      { name: "App-store rating", baseline: 4.6, treatment: 4.6, delta_percent: 0.0, status: "pass" },
    ],
    segment_breakdown: [
      { segment: "iOS, US", lift_percent: 28.4, p_value: 0.04, sample_size: 32_000 },
      { segment: "Android, US", lift_percent: 18.1, p_value: 0.12, sample_size: 28_000 },
      { segment: "iOS, intl", lift_percent: 14.2, p_value: 0.31, sample_size: 27_000 },
      { segment: "Android, intl", lift_percent: 11.6, p_value: 0.48, sample_size: 23_000 },
    ],
    what_we_learned:
      "Aggregate result was just-not-significant (+21% relative, p=0.08), but the iOS-US cell was the clear story: significant lift (+28%, p=0.04) where the AI remix's effort showed up disproportionately. We did NOT have power to make a clear statement on the other 3 cells — they trend positive but at lower effect sizes that 110K spread across 4 cells couldn't resolve at p<0.05. The economic question is the closer call: at $0.42 cost-per-reactivation, we'd need ~3% downstream subscription rate from reactivated users to break even on email + AI-remix-generation costs. We don't have that data yet. Aisha is pursuing two follow-ups: (1) re-run the iOS-US cell at 3x sample size to confirm the win, (2) measure 30-day-post-reactivation subscription rate to nail down economics. Cross-experiment hook: AI-personalization cost ($0.24/email from API calls) showed up here as a hard guardrail blocker for the first time. All future personalization experiments need a cost-vs-lift analysis baked in from the start.",
    failure_modes: ["underpowered"],
    team: "Lifecycle",
    pm: "Aisha Mensah",
    embedding: [],
    tags: ["email_winback", "lapsed_users", "personalization", "ai_remix", "inconclusive_result", "channel_cost", "d7_retention"],
  },

  // ─── exp_008 · Onboarding · live · — (D7 subplot) ─────────────────
  {
    id: "exp_008",
    title: "No tutorial — drop new users straight into the home screen",
    hypothesis:
      "Removing the onboarding tutorial entirely for organic-search-acquired users — currently a 4-screen flow even after exp_001's iOS fast-path shipped — will lift D7 retention by 1.5pp+, by trusting the home screen and AI-suggested edit prompts to teach. Counter-intuitive bet: tutorials filter out exactly the curious users we want to keep.",
    category: "onboarding",
    lifecycle: "live",
    decision: null,
    start_date: "2026-04-30",
    end_date: null,
    duration_days: 28,
    segment: "New organic-search users, iOS + Android, US",
    segment_size: 200_000,
    primary_metric: "D7 retention",
    primary_metric_baseline: 17.4,
    primary_metric_treatment: 18.2,
    lift_percent: 4.6,
    p_value: 0.14,
    sample_size: 88_000,
    guardrail_metrics: [
      { name: "'First edit confusion' support tickets (daily)", baseline: 18, treatment: 22, delta_percent: 22.2, status: "warn" },
      { name: "App-store rating (28-day)", baseline: 4.6, treatment: 4.55, delta_percent: -1.1, status: "pass" },
      { name: "Crash rate (per 1k sessions)", baseline: 0.36, treatment: 0.37, delta_percent: 2.8, status: "pass" },
      { name: "Time to first edit (sec)", baseline: 142, treatment: 89, delta_percent: -37.3, status: "pass" },
    ],
    segment_breakdown: [
      { segment: "iOS, organic search", lift_percent: 9.2, p_value: 0.03, sample_size: 44_000 },
      { segment: "Android, organic search", lift_percent: 5.1, p_value: 0.18, sample_size: 44_000 },
    ],
    what_we_learned:
      "Live experiment — interim only (day 12 of 28). The bet is paying off in early signal for the iOS-organic-search cell (+9.2%, p=0.03) — these users WERE being filtered by the tutorial. Android-organic-search is trending positive but not significant yet. The expected support-ticket cost is materializing (+22%) — at our 'manageable' threshold set in pre-flight, but worth monitoring. Open question we'll face at decision time: do we ship to organic-search specifically (and keep the tutorial for paid-acquisition users), or roll out broadly? exp_001's segment-shipping precedent makes the former more defensible. Cross-experiment hook: this is the second test this quarter where 'organic-search has different needs than paid-acquisition' shows up (exp_001 was the first). The pattern is hardening. Priya's question for the lessons graph: is this really 'organic vs paid' or is it 'low-intent vs high-intent traffic' generalized? Worth a deliberate test once the broader pattern is confirmed.",
    failure_modes: [],
    team: "Onboarding",
    pm: "Priya Subramanian",
    embedding: [],
    tags: ["onboarding_friction", "d7_retention", "organic_search", "tutorial_removal", "paid_vs_organic", "counter_intuitive"],
  },

  // ─── exp_009 · Monetization · in_review · — (pre-launch) ──────────
  {
    id: "exp_009",
    title: "Hard AI paywall after 2 free uses + new $2.99 lightweight tier",
    hypothesis:
      "Replacing the current soft AI paywall (rate-limited 'watch ad' delays) with a hard 2-use limit + a new $2.99/mo AI-only tier alongside the existing $7.99 Pro will lift AI feature ARPU by 40%+, while accepting a likely small drop in free-user AI engagement. The $2.99 tier exists to convert blocked users who won't pay $7.99 — softens the hard-stop while still monetizing.",
    category: "paywall",
    lifecycle: "in_review",
    decision: null,
    start_date: null,
    end_date: null,
    duration_days: 30,
    segment: "Free users with ≥1 AI feature use in the last 30 days, iOS + Android, US (Phase 1)",
    segment_size: 180_000,
    primary_metric: "AI feature ARPU (free + paid combined, $/user/month)",
    primary_metric_baseline: 0.84,
    primary_metric_treatment: null,
    lift_percent: null,
    p_value: null,
    sample_size: null,
    guardrail_metrics: [
      { name: "Free AI feature engagement (edits/user/week)", baseline: 2.3, treatment: null, delta_percent: null, status: "pending" },
      { name: "App-store rating (planned floor: 4.4)", baseline: 4.6, treatment: null, delta_percent: null, status: "pending" },
      { name: "$7.99 Pro conversion rate (cannibalization check)", baseline: 2.8, treatment: null, delta_percent: null, status: "pending" },
      { name: "Customer support tickets (paywall-related)", baseline: 12, treatment: null, delta_percent: null, status: "pending" },
    ],
    segment_breakdown: [],
    what_we_learned:
      "In review (not yet launched). Pre-flight check is the open question — the last time Monetization shipped a hard paywall (exp_036 in 2024) it correlated with a meaningful drop in app-store rating that took 4 months to recover. The mitigation in this design: the $2.99 lightweight tier alongside the hard limit, so users have a low-cost option instead of binary 'paid or blocked.' Aisha (UXR) is interviewing 12 free users this week to pressure-test the copy and limit messaging. Two flags in review: (1) Does the $2.99 tier cannibalize $7.99 Pro? Theoretical model says no but we have no data. (2) The exp_002 'shipped' result was based on aha-moment positioning — a HARD paywall is structurally different and may not preserve that win. Senior-analyst critique from review: 'the projected +40% ARPU lift assumes 30% of blocked users convert to the $2.99 tier; if that number is 15%, the test loses money even before app-store-rating cost.' Awaiting decision on whether to launch the experiment or kill the proposal pre-flight.",
    failure_modes: [],
    team: "Monetization",
    pm: "David Okafor",
    embedding: [],
    tags: ["paywall_placement", "hard_paywall", "ai_feature_paywall", "tiered_pricing", "monetization_funnel", "cannibalization_risk", "in_review"],
  },

  // ─── exp_010 · Growth · archived · killed (2024) ──────────────────
  {
    id: "exp_010",
    title: "Mandatory referral wall before session 2 (2024 attempt)",
    hypothesis:
      "Requiring users to send at least one referral invitation before granting access to the home screen on session 2 will create a viral loop and lift install-to-D7 retention by 5pp+, by anchoring users in social context before they can lapse. (2024 hypothesis — included as cautionary archive.)",
    category: "growth_loop",
    lifecycle: "archived",
    decision: "killed",
    start_date: "2024-08-12",
    end_date: "2024-08-18",
    duration_days: 6,
    segment: "New users, iOS + Android, US (planned 21 days; killed on day 6)",
    segment_size: 42_000,
    primary_metric: "Install-to-D7 retention",
    primary_metric_baseline: 14.1,
    primary_metric_treatment: 8.9,
    lift_percent: -36.9,
    p_value: 0.0001,
    sample_size: 42_000,
    guardrail_metrics: [
      { name: "App-store rating (7-day)", baseline: 4.6, treatment: 3.9, delta_percent: -15.2, status: "fail" },
      { name: "Uninstall rate (7-day)", baseline: 22.0, treatment: 47.0, delta_percent: 113.6, status: "fail" },
      { name: "Customer support tickets (daily)", baseline: 18, treatment: 90, delta_percent: 400.0, status: "fail" },
      { name: "Brand search volume (7d MoM)", baseline: 0.0, treatment: -8.0, delta_percent: -8.0, status: "warn" },
    ],
    segment_breakdown: [
      { segment: "iOS, US", lift_percent: -38.2, p_value: 0.00005, sample_size: 22_000 },
      { segment: "Android, US", lift_percent: -34.1, p_value: 0.0002, sample_size: 20_000 },
    ],
    what_we_learned:
      "Killed on day 6 of a planned 21-day run after every metric we cared about cratered. Install-to-D7 fell 37% relative; uninstall rate more than doubled; app-store rating fell 0.7 points in 72 hours and took ~3 months to recover. The original hypothesis assumed 'social anchoring' would offset 'forced action friction.' It did not — friction dominated by an order of magnitude. Two institutional changes followed this experiment: (1) any onboarding test involving a mandatory action gate now requires senior PM + UXR + Legal review before approval (Legal because the requested action — sending invites with our brand attached to friends' addresses — touches consent/anti-spam frameworks; we didn't catch this risk pre-launch). (2) The 'dark_pattern' tag was created specifically to make experiments like this one findable in pre-flight. This is the only experiment in Postmark's archive flagged with that tag — intentionally, so that anyone proposing anything resembling forced user action gets the warning. Note for future readers: Marcus, the PM who owned this, left Pixmate in late 2024 — context for any tribal-knowledge gaps in follow-up discussions.",
    failure_modes: [],
    team: "Growth",
    pm: "Marcus Webb",
    embedding: [],
    tags: ["viral_loop", "referral_wall", "dark_pattern", "retention_disaster", "archived_2024", "install_retention", "regulatory_risk"],
  },
];

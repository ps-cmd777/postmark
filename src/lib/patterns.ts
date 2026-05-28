// Hand-curated meta-patterns surfaced from the seed corpus. Static
// data, not AI-derived — the value is the curation. Render path is
// /lessons (page) and the "Part of these patterns" section on each
// experiment detail page.
//
// To add a pattern: append to PATTERNS, pick the next pattern_NN id,
// reference experiments by their seed id, set strength honestly. Do
// not derive these from tags; tag-derivation produces false positives
// that lose the meta-pattern's point.

export type PatternStrength = "hardened" | "emerging" | "single_instance";

export interface Pattern {
  id: string;
  name: string;
  strength: PatternStrength;
  description: string;
  member_experiment_ids: string[];
  counter_instance_ids?: string[];
  institutional_response?: string;
  open_question?: string;
  refined_lesson?: string;
}

export const PATTERNS: Pattern[] = [
  {
    id: "pattern_01",
    name: "Forced action in onboarding fails",
    strength: "hardened",
    description:
      "Any experiment that requires a new user to perform an action — set up something, send something, verify something — before reaching the editor has failed catastrophically in this corpus. The retention math is consistent: friction at the gate filters out far more legitimate users than the gate filters out unwanted ones. The 'social anchoring' or 'identity formation' or 'spam reduction' rationales that motivate these experiments all assume the gate's value dominates its cost. It never has.",
    member_experiment_ids: ["exp_010", "exp_027"],
    counter_instance_ids: ["exp_018"],
    institutional_response:
      "The 'dark_pattern' tag was created specifically to make forced-action experiments findable in pre-flight review. Any hypothesis containing 'mandatory' or 'required' applied to a user action in the first 3 sessions triggers senior PM + UXR + Legal review before approval.",
  },
  {
    id: "pattern_02",
    name: "Blocking onboarding surfaces are friction",
    strength: "hardened",
    description:
      "Any surface in onboarding that interrupts the user (modal, full-screen overlay, mandatory dismiss) underperforms compared to contextual surfaces (in-app nudge, email, inline prompt). The pattern holds across messaging type — welcome content, tutorial guidance, retention nudges. The mechanism: blocking surfaces register as friction regardless of how helpful their content is; the user's primary signal is 'this is in my way,' not 'this is useful.' This pattern is adjacent to but distinct from Pattern 1 (forced action). A blocking surface can be dismissed without performing an action — but the dismissal itself is the friction signal.",
    member_experiment_ids: ["exp_006", "exp_038", "exp_027"],
    counter_instance_ids: ["exp_020"],
    institutional_response:
      "The pre-flight check now classifies any new-user-blocking surface as high-risk by default. The 'pause → redesign → relaunch as nudge' pattern (exp_006 → exp_020) is Maria Chen's default playbook when a treatment introduces a new surface.",
  },
  {
    id: "pattern_03",
    name: "On-device vision on low-RAM Android crashes",
    strength: "hardened",
    description:
      "Any feature that runs an on-device vision-class AI model (image generation, portrait synthesis, image classification at meaningful model size) under-serves the bottom third of Android — devices with <4GB RAM, which is ~32% of Pixmate's Android base in the affected segments. Crash rates spike. Even with quantization, the lowest tier bumps into memory ceilings. The constraint is specifically on-device VISION at current model sizes. It is NOT a universal 'on-device AI' constraint — see counter-instance.",
    member_experiment_ids: ["exp_001", "exp_022"],
    counter_instance_ids: ["exp_039"],
    institutional_response:
      "Any future on-device AI feature launches against a device-RAM distribution check in pre-flight. Q3 charter (Lena Sokolova) to ship a quantized-model pipeline before more on-device AI features land. Currently overdue.",
  },
  {
    id: "pattern_04",
    name: "iOS captures 2x the lift of Android across onboarding experiments",
    strength: "hardened",
    description:
      "When Pixmate ships an onboarding or home-screen experiment, the iOS variant consistently shows ~2x the relative lift of the Android variant. This pattern holds across paid-vs-organic acquisition, across forced-vs-skippable, across blocking-vs-nudge. The mechanism is structural: the Android editor's home screen has more discovery friction (smaller filter chips, no quick-action FAB) than iOS, so reducing onboarding friction has more headroom on iOS where the destination is more usable. This pattern's implication for experiment design: power calculations should be done per-platform, not on aggregate. An aggregate 2pp+ D7 lift target is unrealistic for Android-only rollouts in this corpus.",
    member_experiment_ids: ["exp_001", "exp_019", "exp_020", "exp_037", "exp_022"],
    institutional_response:
      "Q3 charter (Lena Sokolova): Android home-screen redesign. Rationale: the pattern says the Android editor surface needs a structural redesign, not more onboarding experiments around it.",
  },
  {
    id: "pattern_05",
    name: "Push fatigue depletes a finite permission budget",
    strength: "hardened",
    description:
      "Every push notification a team sends consumes from a shared, finite resource: the user's willingness to keep notifications on. When a treatment moves D7 retention nominally but spikes the opt-out rate, the long-run cost outweighs the short-term gain — once users disable push, the Lifecycle team can no longer reach them through any push, including critical ones. The pattern recurs because individual teams add notifications independently and the user pays the cost only at opt-out time, externalizing it from the team that triggered it. The corpus now treats notification permission as a budget (analogous to a quota) rather than as an unlimited channel. Two earlier 2025 Lifecycle tests preceded the named instance and established the pattern.",
    member_experiment_ids: ["exp_003"],
    institutional_response:
      "Permission-budget check is now required in pre-flight for any experiment introducing a new push. 'Alternate channel' tests (in-app modal, nudge, email) for the same use case became standard — see exp_006, exp_020 lineage.",
  },
  {
    id: "pattern_06",
    name: "Cohort-extension playbook for nudge mechanics",
    strength: "emerging",
    description:
      "When a contextual nudge mechanic works at one user-state (e.g., 'session-2 users who haven't completed first edit'), the same mechanic tends to work at progressively-later cohorts (day-2, day-5) with diminishing but still-positive lift. The corpus is starting to encode this as a deliberate playbook: prove the mechanic on one cohort, then extend to adjacent cohorts in sequence rather than redesigning from scratch. Caution: dismissal rate ticks up at later cohorts (18% → 21% across exp_020 → exp_037), suggesting nudge saturation. The playbook may have a natural ceiling before users become nudge-fatigued in the way they became push-fatigued.",
    member_experiment_ids: ["exp_020", "exp_037"],
    open_question:
      "Do nudges have their own permission budget analogous to push (Pattern 5)? The rising dismissal rate at later cohorts is the early signal that they might. Until tested, the playbook should not be extended past day-5 without measurement.",
  },
  {
    id: "pattern_07",
    name: "Organic-vs-paid is actually iOS-vs-Android in disguise",
    strength: "emerging",
    description:
      "Multiple onboarding experiments were initially framed as testing an 'organic vs paid acquisition' hypothesis (organic-search users self-select; paid-acquisition users arrive with low intent). Result patterns from exp_001 and exp_019 supported this framing — until exp_019's paid-Android cell underperformed in a way exp_001's paid-iOS cell did not. The current corpus reading: the underlying mechanism may not be acquisition channel at all, but iOS-vs-Android usability (see Pattern 4). This pattern is still under investigation. The corpus has not yet run a deliberate 4-cell test (organic-iOS, organic-Android, paid-iOS, paid-Android) sufficient to disambiguate. exp_008's organic-search test is currently mid-flight; conclusion will sharpen this.",
    member_experiment_ids: ["exp_001", "exp_019", "exp_008"],
    refined_lesson:
      "PMs running future onboarding tests should report results 4-celled by default rather than assuming 'organic vs paid' is the relevant cut.",
  },
  {
    id: "pattern_08",
    name: "UXR signal at day-7 prevents 21-day failure cycles",
    strength: "hardened",
    description:
      "When a treatment introduces a new user-facing surface — a modal, a prompt, a UI element users haven't seen before — running the full planned window (typically 21-28 days) before checking UXR signal wastes cycles. The corpus has twice paused experiments at day-7 on UXR data (high dismissal rates, qualitative friction signals) and redesigned to ship successfully on the second try, saving an entire 21-day cycle each time. The mechanism: quantitative retention metrics aggregate slowly and obscure the surface-level friction signal. UXR catches 'this feels like friction' at n=20 users in week 1; the retention number wouldn't show it until week 3, after the full damage is done. The 2025-Q4 winback email pause was the first instance of the pattern; exp_006 was the second.",
    member_experiment_ids: ["exp_006"],
    institutional_response:
      "'When treatment introduces a new surface, default to 7-day UXR check-in before committing to the full window' — now Maria Chen's standing policy for Lifecycle. The post-exp_006 rule prevented exp_006's full failure cycle and informed exp_018's pre-flight 14-user UXR check before launch.",
  },
  {
    id: "pattern_09",
    name: "AI personalization isn't a universal lever",
    strength: "emerging",
    description:
      "Pixmate's general thesis is 'AI personalization lifts metrics.' Most experiments in the corpus support it (exp_001, exp_026, exp_021 power-user cell). But exp_028 cleanly demonstrates a counter-instance: AI-curated content fails to beat a well-tuned static baseline when the static option is already near the engagement ceiling. The pattern is that AI personalization beats generic defaults, not well-curated defaults. The implication for experiment design: when proposing an AI-personalization experiment, the relevant comparison isn't 'AI vs nothing' but 'AI vs the best static option that's already been tuned.'",
    member_experiment_ids: ["exp_028"],
    counter_instance_ids: ["exp_001", "exp_026"],
    refined_lesson:
      "AI personalization needs a 'bad' baseline to beat. Identify whether your control is a 'default we've never optimized' or 'a well-tuned static option.' If the latter, the experiment may fail not because AI is bad but because the headroom is gone.",
  },
  {
    id: "pattern_10",
    name: "Cohort-specific retention playbook",
    strength: "emerging",
    description:
      "Retention interventions don't work universally — they work cohort-typed. The corpus has accumulated enough evidence across 4+ experiments that the casual-user cohort (3-9 edits in 30 days) responds differently than the power-user cohort (50+ edits) and the new-user cohort (day 0-2). A treatment that lifts retention in one cohort may be flat or negative in another. The implication for future retention work: experiments should default to cohort-typed hypotheses with cohort-typed primary metrics, not universal 'lift D7 retention' framings.",
    member_experiment_ids: ["exp_021", "exp_026", "exp_042", "exp_043"],
    refined_lesson:
      "'Retention' isn't a single metric to optimize. The corpus is starting to encode a cohort-typed playbook: new-user retention (Pattern 1-4 territory), casual-user retention (exp_043 territory), and power-user retention (exp_026 / exp_042 territory) are three different problems with different mechanics.",
  },
  {
    id: "pattern_11",
    name: "Behavior-shaping rewards trigger gaming",
    strength: "single_instance",
    description:
      "When a treatment creates a per-user economic signal (a reward triggered by a measurable behavior threshold), users with gaming-prone signatures hit the threshold at a multiple of the organic rate — sometimes 4-5x — during the experiment window. This isn't fraud-fraud (no payment manipulation), but it's a leading indicator that the reward shapes behavior in ways that may not translate to genuine engagement value. The retention signal on real power-users gets contaminated by behavior optimization in the gaming-prone cell. This pattern is 'single instance' because it has only one clean experimental confirmation, but the adjacent exp_026 case (AI personalization having a 'creepy reference' quality flag in 1.2% of subject lines) is a different second-order behavior signal that warrants joint consideration.",
    member_experiment_ids: ["exp_042"],
    counter_instance_ids: ["exp_026"],
    refined_lesson:
      "When designing a treatment that creates an economic or attention incentive, the pre-flight check should include a 'second-order behavior' question: what could shift in the targeted population's behavior in response to the treatment, beyond the intended retention effect?",
  },
  {
    id: "pattern_12",
    name: "Segment-ship is Pixmate's default for mixed-cell tests",
    strength: "hardened",
    description:
      "When an experiment shows clean lift in one segment cell and noise/negative in another, Pixmate's default response is to ship to the winning segment only rather than holding for a broad rollout decision. This pattern has solidified through repeated application across acquisition channel (paid vs organic), platform (iOS vs Android), device class (4GB+ RAM vs <4GB), engagement cohort (power vs casual), and social-graph depth (0-2 followed vs 3+ followed). The trade-off is honest: segment-shipping concedes that 'ship to everyone' is rarely the right answer in a corpus this segmented. The alternative — running mixed-cell experiments to non-significance and not shipping — leaves real lift on the table.",
    member_experiment_ids: ["exp_001", "exp_019", "exp_022", "exp_026", "exp_014"],
    refined_lesson:
      "PMs designing new tests are now expected to specify segment cells before launch (e.g., the 4-cell breakdown that exp_018's pre-flight requires). Aggregate-only result reads are no longer accepted as decision artifacts.",
  },
];

export function getPatternById(id: string): Pattern | undefined {
  return PATTERNS.find((p) => p.id === id);
}

export function getPatternsForExperiment(experimentId: string): Pattern[] {
  return PATTERNS.filter(
    (p) =>
      p.member_experiment_ids.includes(experimentId) ||
      (p.counter_instance_ids ?? []).includes(experimentId),
  );
}

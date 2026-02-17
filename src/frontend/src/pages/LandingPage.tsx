import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import Layout from '../components/Layout';

interface LandingFeature {
  title: string;
  description: string;
  icon: React.ReactNode;
  tone: 'primary' | 'success' | 'info' | 'warning' | 'violet' | 'slate';
}

interface LandingPlan {
  name: string;
  description: string;
  price: string;
  cta: string;
  badge?: string;
  highlighted?: boolean;
  ctaStyle: 'primary' | 'secondary';
  features: string[];
}

interface LandingTestimonial {
  initials: string;
  name: string;
  role: string;
  quote: string;
  tone: 'blue' | 'emerald' | 'slate';
}

const featureCards: LandingFeature[] = [
  {
    title: 'Organized Repository',
    description: 'Categorize and tag scripts for easy discovery. Search by content, purpose, or tags in seconds.',
    tone: 'primary',
    icon: (
      <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    title: 'AI Script Analysis',
    description: 'Automatically analyze scripts for security issues, performance wins, and maintainability risks.',
    tone: 'success',
    icon: (
      <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    title: 'AI Chat Assistant',
    description: 'Chat with an AI assistant that understands PowerShell to help with coding, troubleshooting, and learning.',
    tone: 'info',
    icon: (
      <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
      </svg>
    ),
  },
  {
    title: 'Secure Sharing',
    description: 'Share scripts securely with teams or private groups and keep access tightly controlled.',
    tone: 'warning',
    icon: (
      <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: 'Version Control',
    description: 'Track revisions over time and restore previous versions when deployments or rollbacks are needed.',
    tone: 'violet',
    icon: (
      <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    ),
  },
  {
    title: 'One-Click Deployment',
    description: 'Publish scripts into connected environments with one-step operations and clear audit history.',
    tone: 'slate',
    icon: (
      <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
      </svg>
    ),
  },
];

const plans: LandingPlan[] = [
  {
    name: 'Free',
    description: 'Perfect for individual users and small side projects.',
    price: '$0',
    cta: 'Get Started',
    ctaStyle: 'secondary',
    features: [
      'Store up to 20 PowerShell scripts',
      'Basic script analysis',
      'Community support',
    ],
  },
  {
    name: 'Professional',
    description: 'Advanced tools for power users and small teams.',
    price: '$19',
    cta: 'Start Free Trial',
    badge: 'Most popular',
    highlighted: true,
    ctaStyle: 'primary',
    features: [
      'Unlimited PowerShell scripts',
      'Advanced AI analysis',
      'Priority email support',
      'Full AI chat capabilities',
      'Script versioning',
    ],
  },
  {
    name: 'Enterprise',
    description: 'Built for teams managing critical automation workflows.',
    price: '$99',
    cta: 'Contact Sales',
    ctaStyle: 'secondary',
    features: [
      'Everything in Professional',
      'Team collaboration',
      'Role-based access control',
      'Dedicated support manager',
      'Custom integrations',
    ],
  },
];

const testimonials: LandingTestimonial[] = [
  {
    initials: 'JD',
    name: 'John Doe',
    role: 'IT Director',
    quote: 'This platform transformed how our IT team manages PowerShell scripts. The AI analysis catches issues before we push changes.',
    tone: 'blue',
  },
  {
    initials: 'JS',
    name: 'Jane Smith',
    role: 'DevOps Engineer',
    quote: 'Version control and collaboration make distributed teams feel synchronized. We are easier to ship and safer to ship.',
    tone: 'emerald',
  },
  {
    initials: 'RJ',
    name: 'Robert Johnson',
    role: 'System Administrator',
    quote: 'The AI chat assistant has become a practical pair programmer for PowerShell and reduced our onboarding time significantly.',
    tone: 'slate',
  },
];

const iconToneClass: Record<LandingFeature['tone'], string> = {
  primary: 'bg-blue-500/15 text-blue-500',
  success: 'bg-emerald-500/15 text-emerald-500',
  info: 'bg-cyan-500/15 text-cyan-500',
  warning: 'bg-amber-500/15 text-amber-500',
  violet: 'bg-violet-500/15 text-violet-500',
  slate: 'bg-slate-500/15 text-slate-500',
};

const testimonialToneClass: Record<LandingTestimonial['tone'], string> = {
  blue: 'bg-blue-500/15 text-blue-500',
  emerald: 'bg-emerald-500/15 text-emerald-500',
  slate: 'bg-slate-500/15 text-slate-500',
};

const LandingPage: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();

  const sectionVariants = {
    hidden: { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.36,
        delayChildren: prefersReducedMotion ? 0 : 0.03,
        staggerChildren: prefersReducedMotion ? 0 : 0.08,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.98 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.32,
      },
    },
  };

  const hoverLift = prefersReducedMotion
    ? {}
    : {
        y: -4,
        transition: { duration: 0.16 },
      };

  return (
    <Layout hideSidebar={true}>
      <div className="relative overflow-hidden">
        <motion.div
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
          initial={prefersReducedMotion ? false : 'hidden'}
          animate="show"
          variants={sectionVariants}
        >
          <motion.div
            className="relative overflow-hidden rounded-3xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-6 py-16 sm:px-10 sm:py-20 mb-12"
            variants={cardVariants}
            initial="hidden"
            animate="show"
          >
            <div className="pointer-events-none absolute -top-20 -left-24 h-56 w-56 rounded-full bg-[var(--color-accent)]/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-[var(--color-primary)]/15 blur-3xl" />

            <div className="relative z-10 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
                PowerShell Management Platform
              </div>

              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                <span className="block text-[var(--color-text-secondary)]">PowerShell Script</span>
                <span className="block bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent">Management Simplified</span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-text-secondary)]">
                Organize, analyze, and share your PowerShell scripts with built-in AI assistance, secure controls, and team collaboration.
              </p>

              <motion.div className="mt-10 flex flex-wrap justify-center gap-3" variants={cardVariants}>
                <motion.div whileHover={hoverLift}>
                  <Link
                    to="/register"
                    className="inline-flex items-center rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] px-6 py-3 text-base font-semibold text-white shadow-sm hover:shadow-md"
                  >
                    Get Started for Free
                  </Link>
                </motion.div>
                <motion.div whileHover={hoverLift}>
                  <Link
                    to="/login"
                    className="inline-flex items-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-secondary)] px-6 py-3 text-base font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
                  >
                    Sign In
                  </Link>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>

          <motion.div className="py-6" variants={sectionVariants} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
            <div className="mx-auto max-w-7xl">
              <div className="mb-8 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Features</p>
                <h2 className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">Everything your team needs in one place</h2>
                <p className="mt-3 text-[var(--color-text-secondary)]">From script organization to AI-powered review, shipping is faster and safer.</p>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {featureCards.map((feature) => (
                  <motion.div
                    key={feature.title}
                    variants={cardVariants}
                    whileHover={hoverLift}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
                    className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-6 shadow-sm"
                  >
                    <div className={`inline-flex items-center justify-center rounded-xl ${iconToneClass[feature.tone]} mb-4`}> 
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-medium text-[var(--color-text-primary)]">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">{feature.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div className="py-8" variants={sectionVariants} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
            <div className="mx-auto max-w-7xl">
              <div className="mb-8 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Pricing</p>
                <h2 className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">Plans for teams of all sizes</h2>
                <p className="mt-3 text-[var(--color-text-secondary)]">Choose what your team needs now, then grow into stronger controls later.</p>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => (
                  <motion.div
                    key={plan.name}
                    variants={cardVariants}
                    whileHover={hoverLift}
                    className={`relative overflow-hidden rounded-2xl border ${plan.highlighted ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-border-default)] bg-[var(--color-bg-elevated)]'} p-6 shadow-sm`}
                  >
                    {plan.badge ? (
                      <div className="mb-4 inline-flex items-center rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] px-2.5 py-1 text-xs font-semibold text-white">
                        {plan.badge}
                      </div>
                    ) : null}

                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{plan.name}</h3>
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{plan.description}</p>
                    <p className="mt-5">
                      <span className="text-4xl font-bold text-[var(--color-text-primary)]">{plan.price}</span>
                      <span className="text-base text-[var(--color-text-tertiary)]">/month</span>
                    </p>

                    <Link
                      to="/register"
                      className={`mt-6 mb-6 block rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                        plan.ctaStyle === 'primary'
                          ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white hover:shadow-md'
                          : 'border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                      }`}
                    >
                      {plan.cta}
                    </Link>

                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                          <span className="mt-1 h-4 w-4 shrink-0 rounded-full bg-emerald-500/15 text-emerald-600">
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path d="M16.707 5.293a1 1 0 01-1.414 1.414L9 12.586 4.707 8.293a1 1 0 111.414-1.414L9 9.758l6.707-6.707z" />
                            </svg>
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div className="py-10" variants={sectionVariants} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
            <div className="mx-auto max-w-7xl">
              <div className="mb-8 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Testimonials</p>
                <h2 className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">What teams are saying</h2>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                {testimonials.map((testimonial) => (
                  <motion.div
                    key={testimonial.name}
                    variants={cardVariants}
                    whileHover={hoverLift}
                    className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-6"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-full ${testimonialToneClass[testimonial.tone]} flex items-center justify-center font-bold`}>
                        {testimonial.initials}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--color-text-primary)]">{testimonial.name}</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">{testimonial.role}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-secondary)]">{testimonial.quote}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div className="mb-16 rounded-2xl border border-[var(--color-border-default)] bg-gradient-to-r from-[var(--color-primary)]/20 via-[var(--color-accent)]/20 to-[var(--color-primary)]/20 p-1">
            <div className="rounded-xl bg-[var(--color-bg-elevated)] px-6 py-10 sm:px-10">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Get started</p>
                  <h2 className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">Ready to modernize script operations?</h2>
                  <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">Sign up now and start managing scripts, analyzing risks, and collaborating with your team from one secure workspace.</p>
                </div>

                <div className="flex gap-3">
                  <motion.div whileHover={hoverLift}>
                    <Link
                      to="/register"
                      className="inline-flex items-center rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white"
                    >
                      Get started
                    </Link>
                  </motion.div>
                  <motion.div whileHover={hoverLift}>
                    <Link
                      to="/register"
                      className="inline-flex items-center rounded-full border border-[var(--color-border-default)] px-6 py-3 text-sm font-semibold text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)]"
                    >
                      Contact sales
                    </Link>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default LandingPage;

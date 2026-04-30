import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  image?: string;
  bullets: string[];
  duration: number;
};

const slides: Slide[] = [
  {
    id: 'title',
    eyebrow: 'Hosted Netlify + Supabase operating model',
    title: 'PSScript Training & Support Library',
    body: 'A role-based walkthrough for basic users, beginners, senior engineers, support teams, and executive stakeholders.',
    image: 'docs/screenshots/readme/settings-docs-training.png',
    bullets: ['Find scripts', 'Upload safely', 'Analyze risk', 'Export evidence', 'Support with logs'],
    duration: 7,
  },
  {
    id: 'audiences',
    eyebrow: 'Audience tracks',
    title: 'Train Different Roles At The Right Depth',
    body: 'The same app teaches different outcomes: usage, authoring, technical review, operations, and governance.',
    bullets: [
      'Basic user: search, read, download approved reports',
      'New beginner: upload disposable scripts with complete metadata',
      'Senior engineer: review dependencies, findings, and accepted risk',
      'Admin/support: collect route, role, deploy id, and logs',
      'C-level: understand governance posture and escalation',
    ],
    duration: 8,
  },
  {
    id: 'upload',
    eyebrow: 'Beginner author path',
    title: 'Upload With Complete Metadata',
    body: 'A training upload should be disposable, below the hosted 4 MB limit, and include clear title, category, tags, and owner context.',
    image: 'docs/screenshots/readme/upload.png',
    bullets: ['Use safe test scripts', 'Add meaningful tags', 'Record the script id after upload'],
    duration: 7,
  },
  {
    id: 'analysis',
    eyebrow: 'Security, quality, maintainability, runtime requirements',
    title: 'AI Analysis Is A Review Aid',
    body: 'Senior reviewers should read score, findings, PowerShell version, modules, assemblies, recommendations, and PDF export status.',
    image: 'docs/screenshots/readme/analysis-runtime-requirements.png',
    bullets: ['Treat output as advisory', 'Confirm required modules', 'Document remediation or accepted risk'],
    duration: 8,
  },
  {
    id: 'support',
    eyebrow: 'Escalation packet',
    title: 'Support Needs Reproducible Evidence',
    body: 'A useful support case includes route, user role, script id, expected result, actual result, screenshot, Netlify deploy id, and Supabase log window.',
    image: 'docs/screenshots/readme/analysis.png',
    bullets: ['Classify severity', 'Attach logs', 'Capture cleanup or rollback need'],
    duration: 7,
  },
];

const fps = 30;
export const durationInFrames = slides.reduce((total, slide) => total + slide.duration * fps, 0);

const styles = {
  page: {
    background: '#071018',
    color: '#f6f7f2',
    fontFamily: 'Inter, Arial, sans-serif',
  },
  header: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    background: '#060b11',
    display: 'flex',
    alignItems: 'center',
    padding: '0 80px',
    gap: 28,
  },
  title: {
    fontSize: 64,
    lineHeight: 1.1,
    fontWeight: 900,
    marginTop: 20,
    maxWidth: 820,
  },
  eyebrow: {
    color: '#7dd3fc',
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
  body: {
    color: '#b5bdc8',
    fontSize: 34,
    lineHeight: 1.35,
    maxWidth: 760,
    marginTop: 28,
  },
};

const SlideFrame: React.FC<{slide: Slide; number: number; total: number}> = ({slide, number, total}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 18, stiffness: 90}});
  const imageScale = interpolate(frame, [0, slide.duration * fps], [1, 1.04], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={styles.page}>
      <div style={styles.header}>
        <div style={{fontSize: 30, fontWeight: 900}}>PSScript</div>
        <div style={{fontSize: 18, fontWeight: 900, color: '#9fbe78'}}>AI OPS STUDIO</div>
        <div style={{marginLeft: 'auto', color: '#b5bdc8', fontSize: 22}}>
          {String(number).padStart(2, '0')}/{String(total).padStart(2, '0')}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 150,
          left: 110,
          transform: `translateY(${interpolate(enter, [0, 1], [32, 0])}px)`,
          opacity: enter,
        }}
      >
        <div style={styles.eyebrow}>{slide.eyebrow}</div>
        <div style={styles.title}>{slide.title}</div>
        <div style={styles.body}>{slide.body}</div>
        <div style={{marginTop: 46, display: 'grid', gap: 18, maxWidth: 760}}>
          {slide.bullets.map((bullet) => (
            <div key={bullet} style={{display: 'flex', gap: 18, fontSize: 28, lineHeight: 1.25}}>
              <span style={{color: '#7dd3fc'}}>◆</span>
              <span>{bullet}</span>
            </div>
          ))}
        </div>
      </div>

      {slide.image ? (
        <div
          style={{
            position: 'absolute',
            top: 150,
            right: 120,
            width: 760,
            height: 780,
            border: '2px solid #2a3a4d',
            borderRadius: 34,
            background: '#142233',
            padding: 28,
            overflow: 'hidden',
          }}
        >
          <Img
            src={staticFile(slide.image)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              transform: `scale(${imageScale})`,
            }}
          />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const PSScriptTrainingVideo: React.FC = () => {
  let start = 0;
  return (
    <AbsoluteFill>
      {slides.map((slide, index) => {
        const from = start;
        start += slide.duration * fps;
        return (
          <Sequence key={slide.id} from={from} durationInFrames={slide.duration * fps}>
            <SlideFrame slide={slide} number={index + 1} total={slides.length} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

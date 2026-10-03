/**
 * JalQ Design System — Industry Standard Dark Theme
 * Reference: Hach Claros, YSI ProDSS, Palintest Lumiso
 */

export const JalqTheme = {
  colors: {
    // ── Backgrounds ─────────────────────────────────────────────────────────
    bgDeep: '#070C18',          // deepest — status bar area
    bgDark: '#0A0F1E',          // app background
    bgCard: '#111827',          // card surface
    bgCardElevated: '#1A2235',  // elevated card / modal
    bgInput: '#0F1829',         // input field background
    bgMuted: '#1E2D45',         // muted section / divider zone

    // ── Borders ──────────────────────────────────────────────────────────────
    borderSubtle: '#1E2D45',    // barely visible divider
    borderDefault: '#243352',   // standard border
    borderFocus: '#06B6D4',     // cyan focus ring

    // ── Brand / Primary — Cyan (scientific precision) ────────────────────────
    primary: '#06B6D4',              // cyan-500
    primaryDark: '#0891B2',          // cyan-600
    primaryGlow: 'rgba(6,182,212,0.15)',
    primaryGlowStrong: 'rgba(6,182,212,0.25)',

    // ── Status Colors ────────────────────────────────────────────────────────
    emerald: '#10B981',              // success / pass
    emeraldDark: '#059669',
    emeraldGlow: 'rgba(16,185,129,0.15)',

    amber: '#F59E0B',                // warning / ambiguous
    amberDark: '#D97706',
    amberGlow: 'rgba(245,158,11,0.15)',

    crimson: '#EF4444',              // error / fail
    crimsonDark: '#DC2626',
    crimsonGlow: 'rgba(239,68,68,0.15)',

    // ── Typography ───────────────────────────────────────────────────────────
    textPrimary: '#F1F5F9',          // slate-100
    textSecondary: '#94A3B8',        // slate-400
    textMuted: '#475569',            // slate-600
    textInverse: '#0A0F1E',          // on bright surfaces

    // ── Status Badges ────────────────────────────────────────────────────────
    badgeSuccessBg: 'rgba(16,185,129,0.12)',
    badgeSuccessBorder: 'rgba(16,185,129,0.30)',
    badgeSuccessText: '#34D399',

    badgeWarningBg: 'rgba(245,158,11,0.12)',
    badgeWarningBorder: 'rgba(245,158,11,0.30)',
    badgeWarningText: '#FCD34D',

    badgeErrorBg: 'rgba(239,68,68,0.12)',
    badgeErrorBorder: 'rgba(239,68,68,0.30)',
    badgeErrorText: '#FCA5A5',

    badgeInfoBg: 'rgba(6,182,212,0.12)',
    badgeInfoBorder: 'rgba(6,182,212,0.30)',
    badgeInfoText: '#67E8F9',
  },

  // ── Spacing Scale ──────────────────────────────────────────────────────────
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 40,
  },

  // ── Border Radius ─────────────────────────────────────────────────────────
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
    xxl: 24,
    pill: 100,
  },

  // ── Typography Scale ──────────────────────────────────────────────────────
  text: {
    xs:   { fontSize: 10, lineHeight: 14 },
    sm:   { fontSize: 12, lineHeight: 16 },
    base: { fontSize: 14, lineHeight: 20 },
    md:   { fontSize: 15, lineHeight: 22 },
    lg:   { fontSize: 17, lineHeight: 24 },
    xl:   { fontSize: 20, lineHeight: 28 },
    xxl:  { fontSize: 24, lineHeight: 32 },
    xxxl: { fontSize: 30, lineHeight: 38 },
  },

  // ── Shadows ───────────────────────────────────────────────────────────────
  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 5,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 10,
    },
    cyan: {
      shadowColor: '#06B6D4',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
  },

  typography: {
    fontFamilyMono: 'System',
  },
};

// ── Shared reusable style atoms ────────────────────────────────────────────
export const DS = {
  // Full-width primary CTA button
  primaryBtn: {
    backgroundColor: JalqTheme.colors.primary,
    paddingVertical: 15,
    borderRadius: JalqTheme.radius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryBtnText: {
    color: JalqTheme.colors.textInverse,
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },

  // Ghost / outline button
  ghostBtn: {
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
    paddingVertical: 13,
    borderRadius: JalqTheme.radius.lg,
    alignItems: 'center' as const,
  },
  ghostBtnText: {
    color: JalqTheme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },

  // Standard card
  card: {
    backgroundColor: JalqTheme.colors.bgCard,
    borderRadius: JalqTheme.radius.lg,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderSubtle,
    padding: JalqTheme.spacing.lg,
  },

  // Input field
  input: {
    backgroundColor: JalqTheme.colors.bgInput,
    borderWidth: 1,
    borderColor: JalqTheme.colors.borderDefault,
    borderRadius: JalqTheme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: JalqTheme.colors.textPrimary,
    fontSize: 14,
  },

  // Field label above input
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: JalqTheme.colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },

  // Section heading
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: JalqTheme.colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
};

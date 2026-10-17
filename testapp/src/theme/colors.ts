/**
 * JalQ Design System — Clean Professional Light Theme (White & Sky-Blue)
 * Designed for clinical & client-ready clarity
 */

export const JalqTheme = {
  colors: {
    // ── Backgrounds ─────────────────────────────────────────────────────────
    bgDeep: '#FFFFFF',          // status bar & pure white base
    bgDark: '#F8FAFC',          // app background (crisp slate/white canvas)
    bgCard: '#FFFFFF',          // card surface (pure white)
    bgCardElevated: '#FFFFFF',  // elevated card / modal
    bgInput: '#F0F9FF',         // soft sky-tinted input field background
    bgMuted: '#E0F2FE',         // sky blue light accent / divider zone

    // ── Borders ──────────────────────────────────────────────────────────────
    borderSubtle: '#E2E8F0',    // subtle light gray divider
    borderDefault: '#BAE6FD',   // sky blue 200 border
    borderFocus: '#0284C7',     // sky blue 600 focus ring

    // ── Brand / Primary — Sky Blue (Clean, Professional & Scientific) ───────
    primary: '#0284C7',              // sky-600
    primaryDark: '#0369A1',          // sky-700
    primaryLight: '#38BDF8',         // sky-400
    primaryGlow: 'rgba(2,132,199,0.08)',
    primaryGlowStrong: 'rgba(2,132,199,0.18)',

    // ── Status Colors ────────────────────────────────────────────────────────
    emerald: '#059669',              // success / pass (emerald-600)
    emeraldDark: '#047857',
    emeraldGlow: 'rgba(5,150,105,0.08)',

    amber: '#D97706',                // warning / ambiguous (amber-600)
    amberDark: '#B45309',
    amberGlow: 'rgba(217,119,6,0.08)',

    crimson: '#DC2626',              // error / fail (red-600)
    crimsonDark: '#B91C1C',
    crimsonGlow: 'rgba(220,38,38,0.08)',

    // ── Typography ───────────────────────────────────────────────────────────
    textPrimary: '#0F172A',          // deep slate-900 for high readability on white
    textSecondary: '#475569',        // slate-600
    textMuted: '#94A3B8',            // slate-400
    textInverse: '#FFFFFF',          // pure white text for buttons & primary accents

    // ── Status Badges ────────────────────────────────────────────────────────
    badgeSuccessBg: '#ECFDF5',
    badgeSuccessBorder: '#A7F3D0',
    badgeSuccessText: '#065F46',

    badgeWarningBg: '#FFFBEB',
    badgeWarningBorder: '#FDE68A',
    badgeWarningText: '#92400E',

    badgeErrorBg: '#FEF2F2',
    badgeErrorBorder: '#FECACA',
    badgeErrorText: '#991B1B',

    badgeInfoBg: '#F0F9FF',
    badgeInfoBorder: '#BAE6FD',
    badgeInfoText: '#0369A1',
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

  // ── Shadows (Refined soft shadows for white cards) ───────────────────────
  shadow: {
    sm: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 4,
    },
    lg: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.10,
      shadowRadius: 20,
      elevation: 8,
    },
    cyan: {
      shadowColor: '#0284C7',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.20,
      shadowRadius: 12,
      elevation: 5,
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
    backgroundColor: '#FFFFFF',
  },
  ghostBtnText: {
    color: JalqTheme.colors.primary,
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
    color: JalqTheme.colors.primaryDark,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
};


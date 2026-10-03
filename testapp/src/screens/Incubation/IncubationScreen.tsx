import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { JalqTheme } from '../../theme/colors';
import { ChemicalTestDetail } from '../../types/jalq';
import { HeaderBackButton } from '../../components';

interface IncubationScreenProps {
  test: ChemicalTestDetail;
  onBack: () => void;
  onProceedToCapture: (actualIncubationSeconds: number) => void;
}

type TimerState = 'NOT_STARTED' | 'RUNNING' | 'COMPLETED';

export const IncubationScreen: React.FC<IncubationScreenProps> = ({
  test,
  onBack,
  onProceedToCapture,
}) => {
  const targetSeconds = test.incubation_seconds || 300;
  const [secondsRemaining, setSecondsRemaining] = useState(targetSeconds);
  const [timerState, setTimerState] = useState<TimerState>('NOT_STARTED');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerState === 'RUNNING') {
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setTimerState('COMPLETED');
            return 0;
          }
          return prev - 1;
        });
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timerState]);

  const handleStartTimer = () => {
    setTimerState('RUNNING');
  };

  const handlePauseTimer = () => {
    setTimerState('NOT_STARTED');
  };

  const handleFastForwardDemo = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSecondsRemaining(0);
    setElapsedSeconds(targetSeconds);
    setTimerState('COMPLETED');
  };

  const handleCapturePress = () => {
    if (timerState !== 'COMPLETED') {
      Alert.alert(
        'Reaction Incomplete',
        `This chemical reaction requires ${Math.round(targetSeconds / 60)} minutes of incubation for full color development. Premature capture will lead to an inaccurate color reading.`,
        [
          { text: 'Wait for Reaction', style: 'cancel' },
          {
            text: 'Bypass (Demo Mode)',
            onPress: () => onProceedToCapture(elapsedSeconds || targetSeconds),
            style: 'destructive',
          },
        ]
      );
      return;
    }
    onProceedToCapture(targetSeconds);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.min(
    100,
    Math.round(((targetSeconds - secondsRemaining) / targetSeconds) * 100)
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={JalqTheme.colors.bgDeep} />
      {/* Top Bar */}
      <View style={styles.navBar}>
        <HeaderBackButton onPress={onBack} label="Details" />
        <Text style={styles.navTitle}>Reaction Incubation</Text>
        <View style={styles.navPlaceholder} />
      </View>

      <View style={styles.content}>
        {/* Status Indicator */}
        <View
          style={[
            styles.stateBadge,
            timerState === 'COMPLETED'
              ? styles.stateBadgeCompleted
              : timerState === 'RUNNING'
              ? styles.stateBadgeRunning
              : styles.stateBadgeIdle,
          ]}>
          <View
            style={[
              styles.stateDot,
              timerState === 'COMPLETED'
                ? styles.dotCompleted
                : timerState === 'RUNNING'
                ? styles.dotRunning
                : styles.dotIdle,
            ]}
          />
          <Text
            style={[
              styles.stateBadgeText,
              timerState === 'COMPLETED'
                ? styles.textCompleted
                : timerState === 'RUNNING'
                ? styles.textRunning
                : styles.textIdle,
            ]}>
            {timerState === 'COMPLETED'
              ? 'Reaction complete'
              : timerState === 'RUNNING'
              ? 'Color developing...'
              : 'Ready to start'}
          </Text>
        </View>

        {/* Timer Display */}
        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>Time remaining</Text>
          <Text
            style={[
              styles.digitalClock,
              timerState === 'COMPLETED' && styles.digitalClockCompleted,
            ]}>
            {formatTime(secondsRemaining)}
          </Text>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor:
                    timerState === 'COMPLETED' ? '#059669' : '#0284C7',
                },
              ]}
            />
          </View>
          <Text style={styles.progressPercentText}>{progressPercent}% completed</Text>
        </View>

        {/* Reaction Instructions Card */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionHeading}>While you wait</Text>
          <View style={styles.instructionList}>
            <Text style={styles.instructionItem}>
              1. Keep the bottle standing upright on a flat surface.
            </Text>
            <Text style={styles.instructionItem}>
              2. Keep away from direct sunlight or bright lamps.
            </Text>
            <Text style={styles.instructionItem}>
              3. The color will develop to show the chemical concentration.
            </Text>
          </View>
        </View>

        {/* Clean Action Buttons */}
        <View style={styles.buttonContainer}>
          {timerState === 'NOT_STARTED' && (
            <Pressable style={styles.primaryActionBtn} onPress={handleStartTimer}>
              <Text style={styles.primaryActionBtnText}>
                Start {Math.round(targetSeconds / 60)}-Minute Timer
              </Text>
            </Pressable>
          )}

          {timerState === 'RUNNING' && (
            <Pressable style={styles.pauseBtn} onPress={handlePauseTimer}>
              <Text style={styles.pauseBtnText}>Pause Timer</Text>
            </Pressable>
          )}

          {timerState === 'COMPLETED' && (
            <Pressable style={styles.completedBtn} onPress={handleCapturePress}>
              <Text style={styles.completedBtnText}>Take Bottle Photo</Text>
            </Pressable>
          )}

          {/* Subtle Demo Fast-Forward Link */}
          {timerState !== 'COMPLETED' && (
            <Pressable
              style={styles.skipBtn}
              onPress={handleFastForwardDemo}>
              <Text style={styles.skipBtnText}>
                Skip timer (testing mode)
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: JalqTheme.colors.bgDark },
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomColor: JalqTheme.colors.borderSubtle, borderBottomWidth: 1,
    backgroundColor: JalqTheme.colors.bgCard,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: JalqTheme.colors.bgMuted },
  backText: { color: JalqTheme.colors.primary, fontSize: 12, fontWeight: '600' },
  navTitle: { color: JalqTheme.colors.textPrimary, fontWeight: '700', fontSize: 15 },
  navPlaceholder: { width: 60 },
  content: { flex: 1, padding: 20, justifyContent: 'space-between' },

  // State badge
  stateBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, gap: 8,
  },
  stateBadgeIdle: { backgroundColor: JalqTheme.colors.bgMuted, borderColor: JalqTheme.colors.borderDefault },
  stateBadgeRunning: { backgroundColor: JalqTheme.colors.badgeInfoBg, borderColor: JalqTheme.colors.badgeInfoBorder },
  stateBadgeCompleted: { backgroundColor: JalqTheme.colors.badgeSuccessBg, borderColor: JalqTheme.colors.badgeSuccessBorder },
  stateDot: { width: 8, height: 8, borderRadius: 4 },
  dotIdle: { backgroundColor: JalqTheme.colors.textMuted },
  dotRunning: { backgroundColor: JalqTheme.colors.primary },
  dotCompleted: { backgroundColor: JalqTheme.colors.emerald },
  stateBadgeText: { fontSize: 12, fontWeight: '600' },
  textIdle: { color: JalqTheme.colors.textSecondary },
  textRunning: { color: JalqTheme.colors.badgeInfoText },
  textCompleted: { color: JalqTheme.colors.badgeSuccessText },

  // Timer card
  timerCard: {
    backgroundColor: JalqTheme.colors.bgCard, borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1, borderRadius: JalqTheme.radius.xl, padding: 24, alignItems: 'center',
    ...JalqTheme.shadow.md,
  },
  timerLabel: { fontSize: 12, fontWeight: '600', color: JalqTheme.colors.textSecondary, marginBottom: 6, letterSpacing: 0.8, textTransform: 'uppercase' },
  digitalClock: {
    fontSize: 56, fontWeight: '800', color: JalqTheme.colors.primary,
    letterSpacing: 2, marginBottom: 18, fontVariant: ['tabular-nums'],
  },
  digitalClockCompleted: { color: JalqTheme.colors.emerald },
  progressBarTrack: { width: '100%', height: 6, backgroundColor: JalqTheme.colors.bgMuted, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressPercentText: { fontSize: 12, fontWeight: '500', color: JalqTheme.colors.textSecondary },

  // Instruction card
  instructionCard: {
    backgroundColor: JalqTheme.colors.bgCard, borderColor: JalqTheme.colors.borderSubtle,
    borderWidth: 1, borderRadius: JalqTheme.radius.lg, padding: 16,
  },
  instructionHeading: { fontSize: 13, fontWeight: '700', color: JalqTheme.colors.textSecondary, marginBottom: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
  instructionList: { gap: 8 },
  instructionItem: { fontSize: 13, color: JalqTheme.colors.textSecondary, lineHeight: 19 },

  // Buttons
  buttonContainer: { gap: 12, alignItems: 'center' },
  primaryActionBtn: {
    width: '100%', backgroundColor: JalqTheme.colors.primary,
    paddingVertical: 15, borderRadius: JalqTheme.radius.lg, alignItems: 'center',
    ...JalqTheme.shadow.cyan,
  },
  primaryActionBtnText: { color: JalqTheme.colors.textInverse, fontWeight: '700', fontSize: 15 },
  pauseBtn: {
    width: '100%', backgroundColor: JalqTheme.colors.bgCard,
    borderColor: JalqTheme.colors.borderDefault, borderWidth: 1,
    paddingVertical: 14, borderRadius: JalqTheme.radius.lg, alignItems: 'center',
  },
  pauseBtnText: { color: JalqTheme.colors.textPrimary, fontWeight: '600', fontSize: 15 },
  completedBtn: {
    width: '100%', backgroundColor: JalqTheme.colors.emerald,
    paddingVertical: 15, borderRadius: JalqTheme.radius.lg, alignItems: 'center',
    ...JalqTheme.shadow.md,
  },
  completedBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  skipBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  skipBtnText: { color: JalqTheme.colors.textMuted, fontSize: 13, fontWeight: '500' },
});


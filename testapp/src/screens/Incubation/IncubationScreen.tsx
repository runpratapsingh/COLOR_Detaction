import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
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
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  backText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '600',
  },
  navTitle: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 15,
  },
  navPlaceholder: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  stateBadgeIdle: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  stateBadgeRunning: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  stateBadgeCompleted: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotIdle: { backgroundColor: '#94A3B8' },
  dotRunning: { backgroundColor: '#0284C7' },
  dotCompleted: { backgroundColor: '#059669' },
  stateBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textIdle: { color: '#64748B' },
  textRunning: { color: '#0284C7' },
  textCompleted: { color: '#059669' },
  timerCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  digitalClock: {
    fontSize: 52,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1,
    marginBottom: 16,
  },
  digitalClockCompleted: {
    color: '#059669',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  instructionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  instructionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  instructionList: {
    gap: 6,
  },
  instructionItem: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  buttonContainer: {
    gap: 12,
    alignItems: 'center',
  },
  primaryActionBtn: {
    width: '100%',
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  pauseBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBtnText: {
    color: '#0F172A',
    fontWeight: '600',
    fontSize: 15,
  },
  completedBtn: {
    width: '100%',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
});

import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { JalqTheme } from '../theme/colors';

export interface HeaderBackButtonProps {
  onPress: () => void;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  color?: string;
}

export const HeaderBackButton: React.FC<HeaderBackButtonProps> = ({
  onPress,
  label,
  disabled = false,
  style,
  color = JalqTheme.colors.textPrimary,
}) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        Boolean(label) && styles.buttonWithLabel,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={label ? `Back to ${label}` : 'Back'}>
      <View style={styles.chevronWrapper}>
        <View style={[styles.chevron, { borderColor: color }]} />
      </View>
      {Boolean(label) && (
        <Text style={[styles.labelText, { color }]}>{label}</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 38,
    minWidth: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 10,
  },
  buttonWithLabel: {
    paddingHorizontal: 12,
  },
  buttonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderColor: 'rgba(255, 255, 255, 0.24)',
    transform: [{ scale: 0.97 }],
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  chevronWrapper: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  chevron: {
    width: 8.5,
    height: 8.5,
    borderLeftWidth: 2.2,
    borderBottomWidth: 2.2,
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginLeft: 4,
  },
});

import React from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

type BrandMarkProps = {
  size?: number;
  showLabel?: boolean;
  compact?: boolean;
  labelColor?: string;
  containerStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

const brandIcon = require('../../assets/brand-icon.png');

export const BrandMark: React.FC<BrandMarkProps> = ({
  size = 56,
  showLabel = true,
  compact = false,
  labelColor = '#171429',
  containerStyle,
  imageStyle,
}) => {
  const imageSize = compact ? size : size;

  return (
    <View style={[styles.container, compact ? styles.compactContainer : null, containerStyle]}>
      <Image
        source={brandIcon}
        resizeMode="contain"
        style={[styles.image, { width: imageSize, height: imageSize }, imageStyle]}
        accessibilityLabel="SmartForm brand mark"
      />
      {showLabel ? (
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: labelColor }]}>SmartForm</Text>
          <Text style={styles.subtitle}>Forms that feel polished</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactContainer: {
    flexShrink: 0,
  },
  image: {
    borderRadius: 18,
  },
  textWrap: {
    marginLeft: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
});
